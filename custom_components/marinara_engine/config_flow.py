"""Config flow for Marinara Engine."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import aiohttp
import voluptuous as vol

from homeassistant.components.webhook import async_generate_id
from homeassistant.config_entries import ConfigEntry, ConfigFlow, OptionsFlow
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult

from homeassistant.helpers.selector import (
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .const import (
    CONF_ENABLED_CATEGORIES,
    CONF_HOST,
    CONF_PORT,
    CONF_PRIMARY_CHAT_ID,
    CONF_WEBHOOK_ID,
    DEFAULT_ENABLED_CATEGORIES,
    DEFAULT_HOST,
    DEFAULT_PORT,
    DOMAIN,
    TOOL_CATEGORIES,
)

_LOGGER = logging.getLogger(__name__)

_STEP_USER_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_HOST, default=DEFAULT_HOST): str,
        vol.Required(CONF_PORT, default=DEFAULT_PORT): vol.Coerce(int),
    }
)


async def _invoke(
    session: aiohttp.ClientSession,
    host: str,
    port: int,
    command: str,
    args: dict[str, Any] | None = None,
) -> Any:
    async with session.post(
        f"http://{host}:{port}/api/invoke",
        json={"command": command, "args": args or None},
        headers={"X-Marinara-CSRF": "1"},
        timeout=aiohttp.ClientTimeout(total=5),
    ) as resp:
        resp.raise_for_status()
        return await resp.json()


async def _fetch_chats(host: str, port: int) -> list[object]:
    async with aiohttp.ClientSession() as session:
        rows = await _invoke(
            session,
            host,
            port,
            "storage_list",
            {
                "entity": "chats",
                "options": {
                    "fields": ["id", "name", "mode", "createdAt", "updatedAt"]
                },
            },
        )
    return rows if isinstance(rows, list) else []


def _chat_options_from_payload(chats: list[object]) -> dict[str, str]:
    """Build safe chat selector options from Marinara storage rows."""
    options: dict[str, str] = {}
    for chat in chats:
        if not isinstance(chat, Mapping):
            _LOGGER.debug("Skipping malformed Marinara chat entry: %s", chat)
            continue
        chat_id = chat.get("id")
        name = chat.get("name")
        if chat_id is None or not name:
            _LOGGER.debug("Skipping incomplete Marinara chat entry: %s", chat)
            continue
        key = str(chat_id)
        if key in options:
            _LOGGER.debug("Skipping duplicate Marinara chat id: %s", key)
            continue
        options[key] = str(name)
    return options


async def _test_connection(host: str, port: int) -> str | None:
    """Return None on success or an error key string on failure."""
    try:
        await _fetch_chats(host, port)
        return None
    except aiohttp.ClientConnectionError:
        return "cannot_connect"
    except aiohttp.ClientResponseError:
        return "cannot_connect"
    except Exception:
        return "unknown"


class MarinaraConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Marinara Engine."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict | None = None
    ) -> FlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            host = user_input[CONF_HOST].strip()
            port = user_input[CONF_PORT]

            error = await _test_connection(host, port)
            if error:
                errors["base"] = error
            else:
                await self.async_set_unique_id(f"{host}:{port}")
                self._abort_if_unique_id_configured()

                return self.async_create_entry(
                    title=f"Marinara Engine ({host}:{port})",
                    data={
                        CONF_HOST: host,
                        CONF_PORT: port,
                        CONF_WEBHOOK_ID: async_generate_id(),
                    },
                )

        return self.async_show_form(
            step_id="user",
            data_schema=_STEP_USER_SCHEMA,
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return MarinaraOptionsFlow(config_entry)


class MarinaraOptionsFlow(OptionsFlow):
    """Options flow: choose which chat is the primary chat for services."""

    def __init__(self, config_entry: ConfigEntry) -> None:
        self._config_entry = config_entry
        self._chats: list[object] = []

    async def async_step_init(
        self, user_input: dict | None = None
    ) -> FlowResult:
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        host = self._config_entry.data[CONF_HOST]
        port = self._config_entry.data[CONF_PORT]
        try:
            self._chats = await _fetch_chats(host, port)
        except Exception:
            self._chats = []

        chat_options = _chat_options_from_payload(self._chats)
        current_chat = self._config_entry.options.get(CONF_PRIMARY_CHAT_ID, "")
        current_cats = self._config_entry.options.get(
            CONF_ENABLED_CATEGORIES, DEFAULT_ENABLED_CATEGORIES
        )

        schema = vol.Schema(
            {
                vol.Optional(CONF_PRIMARY_CHAT_ID, default=current_chat): vol.In(
                    chat_options
                )
                if chat_options
                else str,
                vol.Optional(
                    CONF_ENABLED_CATEGORIES, default=current_cats
                ): SelectSelector(
                    SelectSelectorConfig(
                        options=[
                            SelectOptionDict(value=k, label=v)
                            for k, v in TOOL_CATEGORIES.items()
                        ],
                        multiple=True,
                        mode=SelectSelectorMode.LIST,
                    )
                ),
            }
        )

        return self.async_show_form(step_id="init", data_schema=schema)
