"""DataUpdateCoordinator for Marinara Engine."""

from __future__ import annotations

import json
import logging
from base64 import b64encode
from datetime import timedelta
from typing import Any

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN, SCAN_INTERVAL

_LOGGER = logging.getLogger(__name__)


def _authorization_header(username: str | None, password: str | None) -> str | None:
    user = (username or "").strip()
    if not user:
        return None
    credentials = f"{user}:{password or ''}".encode()
    return f"Basic {b64encode(credentials).decode()}"


def _is_enabled(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    if isinstance(value, (int, float)):
        return value != 0
    return False


class MarinaraCoordinator(DataUpdateCoordinator[dict]):
    """Polls Marinara Engine for chats and agents."""

    def __init__(
        self,
        hass: HomeAssistant,
        host: str,
        port: int,
        username: str | None = None,
        password: str | None = None,
    ) -> None:
        self.base_url = f"http://{host}:{port}"
        self._session = async_get_clientsession(hass)
        self._authorization = _authorization_header(username, password)
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=SCAN_INTERVAL),
        )

    def _headers(self) -> dict[str, str]:
        headers = {"X-Marinara-CSRF": "1"}
        if self._authorization:
            headers["Authorization"] = self._authorization
        return headers

    async def _invoke(
        self,
        command: str,
        args: dict[str, Any] | None = None,
        timeout_seconds: int = 10,
    ) -> Any:
        async with self._session.post(
            f"{self.base_url}/api/invoke",
            json={"command": command, "args": args or None},
            headers=self._headers(),
            timeout=aiohttp.ClientTimeout(total=timeout_seconds),
        ) as resp:
            resp.raise_for_status()
            return await resp.json()

    async def _storage_list(
        self, entity: str, options: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        rows = await self._invoke(
            "storage_list", {"entity": entity, "options": options or None}
        )
        return rows if isinstance(rows, list) else []

    async def _storage_create(
        self, entity: str, value: dict[str, Any]
    ) -> dict[str, Any]:
        created = await self._invoke(
            "storage_create", {"entity": entity, "value": value}
        )
        return created if isinstance(created, dict) else {}

    async def _storage_update(
        self, entity: str, record_id: str, patch: dict[str, Any]
    ) -> dict[str, Any]:
        updated = await self._invoke(
            "storage_update",
            {"entity": entity, "id": record_id, "patch": patch},
        )
        return updated if isinstance(updated, dict) else {}

    async def _async_update_data(self) -> dict:
        try:
            chats = await self._storage_list(
                "chats",
                {
                    "fields": [
                        "id",
                        "name",
                        "mode",
                        "createdAt",
                        "updatedAt",
                    ]
                },
            )
            agents = await self._storage_list("agents")

            return {"chats": chats, "agents": agents}
        except aiohttp.ClientConnectionError as err:
            raise UpdateFailed(f"Cannot reach Marinara Engine: {err}") from err
        except aiohttp.ClientResponseError as err:
            raise UpdateFailed(f"Marinara Engine returned error {err.status}") from err
        except Exception as err:
            raise UpdateFailed(f"Unexpected error: {err}") from err

    async def async_verify_connection(self) -> None:
        """Raise ConfigEntryNotReady if the authenticated health/API checks fail."""
        try:
            async with self._session.get(
                f"{self.base_url}/health",
                headers=self._headers(),
                timeout=aiohttp.ClientTimeout(total=5),
            ) as resp:
                resp.raise_for_status()
            await self._invoke(
                "storage_list",
                {"entity": "chats", "options": {"fields": ["id"], "limit": 1}},
                timeout_seconds=5,
            )
        except Exception as err:
            raise ConfigEntryNotReady(
                f"Cannot connect to Marinara Engine at {self.base_url}: {err}"
            ) from err

    async def send_message(self, chat_id: str, content: str, role: str = "user") -> None:
        """Create a message in a chat through the refactor storage API."""
        await self._storage_create(
            "messages",
            {
                "chatId": chat_id,
                "role": role,
                "content": content,
                "characterId": None,
                "extra": {},
                "activeSwipeIndex": 0,
                "swipes": [{"content": content}],
            },
        )

    async def trigger_generation(
        self, chat_id: str, user_message: str | None = None
    ) -> None:
        """Record a user message; generation itself is client-owned in refactor."""
        if user_message:
            await self.send_message(chat_id, user_message)
        _LOGGER.warning(
            "Marinara Engine refactor does not expose the desktop generation loop "
            "through marinara-server; open the chat in the desktop client to generate."
        )

    async def abort_generation(self) -> None:
        """Legacy compatibility hook; remote generation is not hostable."""
        _LOGGER.warning(
            "Marinara Engine refactor does not expose desktop generation aborts "
            "through marinara-server."
        )

    async def set_agent_enabled(self, agent_id: str, enabled: bool) -> None:
        """Toggle global enabled state for an agent."""
        await self._storage_update(
            "agents", agent_id, {"enabled": "true" if enabled else "false"}
        )

    async def sync_agent(self, enabled_categories: list[str]) -> str:
        """Create or update the Home Assistant agent in Marinara.

        Returns "created", "updated", or "unchanged".
        """
        from .const import HA_AGENT_PROMPT, tools_for_categories

        tool_names = [t["name"] for t in tools_for_categories(enabled_categories)]

        agents = await self._storage_list("agents")

        existing = next(
            (
                agent
                for agent in agents
                if isinstance(agent, dict) and agent.get("type") == "home_assistant"
            ),
            None,
        )

        if existing is not None:
            settings = existing.get("settings") or {}
            if isinstance(settings, str):
                try:
                    settings = json.loads(settings)
                except (TypeError, ValueError) as err:
                    _LOGGER.warning(
                        "Invalid JSON in Home Assistant agent settings for id=%s: %s",
                        existing.get("id"),
                        err,
                    )
                    settings = {}
            if not isinstance(settings, dict):
                settings = {}
            current_tools = settings.get("enabledTools") or []
            if set(current_tools) == set(tool_names):
                return "unchanged"
            await self._storage_update(
                "agents",
                existing["id"],
                {"settings": {**settings, "enabledTools": tool_names}},
            )
            return "updated"

        payload = {
            "type": "home_assistant",
            "name": "Home Assistant",
            "description": (
                "Controls Home Assistant smart home devices: lights, climate, "
                "covers, locks, media players, scenes, and scripts."
            ),
            "phase": "parallel",
            "enabled": "true",
            "connectionId": None,
            "promptTemplate": HA_AGENT_PROMPT,
            "settings": {"enabledTools": tool_names},
        }
        await self._storage_create("agents", payload)

        return "created"

    async def sync_tools(
        self, webhook_url: str, enabled_categories: list[str]
    ) -> tuple[int, int]:
        """Upsert HA tool definitions into Marinara for the given categories.

        Creates missing tools and updates existing ones so schema changes propagate.
        Returns (created, updated) counts.
        """
        from .const import TOOL_DEFINITIONS, tools_for_categories

        tools = tools_for_categories(enabled_categories)
        selected_names = {tool["name"] for tool in tools}
        managed_names = {tool["name"] for tool in TOOL_DEFINITIONS}

        existing = await self._storage_list("custom-tools")

        existing_by_name = {
            t["name"]: t
            for t in existing
            if isinstance(t, dict) and isinstance(t.get("name"), str)
        }

        created = 0
        updated = 0
        for tool in tools:
            payload = {
                "name": tool["name"],
                "description": tool["description"],
                "parametersSchema": tool["parametersSchema"],
                "executionType": "webhook",
                "webhookUrl": webhook_url,
                "enabled": "true",
            }
            if tool["name"] in existing_by_name:
                tool_id = existing_by_name[tool["name"]]["id"]
                await self._storage_update("custom-tools", tool_id, payload)
                updated += 1
            else:
                await self._storage_create("custom-tools", payload)
                created += 1

        for name, existing_tool in existing_by_name.items():
            if (
                name in managed_names
                and name not in selected_names
                and existing_tool.get("webhookUrl") == webhook_url
                and _is_enabled(existing_tool.get("enabled"))
            ):
                await self._storage_update(
                    "custom-tools", existing_tool["id"], {"enabled": "false"}
                )
                updated += 1

        return created, updated
