import { test, expect } from "@playwright/test";
import { prepareFreshClient } from "../helpers/fresh-client.js";

// E2E Test Happy Path  ### Full Flow from fresh start

test("Story Bundle Happy Path", async ({ page }) => {
  // The flow touches two external services (card index, agent catalog) and
  // retries their flaky first requests; under full-suite parallel load the
  // upstream card search can stall several times, so keep headroom.
  test.setTimeout(180_000);

  // Ids of everything created/used in this run. Filled as soon as an id is
  // available and reused for adding to the story bundle. Names travel along
  // so the bundle editor's paginated picker can be narrowed deterministically.
  const characters: Array<{ id: string; name: string }> = [];
  let persona: string | undefined;
  const lorebook: string[] = [];
  let preset: string | undefined;
  const agents: string[] = [];

  await test.step("Open App", async () => {
    await prepareFreshClient(page);
    // Navigate through the project's baseURL (desktop and mobile projects
    // run against separate servers). A hardcoded port would point the UI at
    // one server while page.request.* resolves against the other.
    await page.goto("/");
  });

  // CHARACTERS
  await test.step("Create Character Lyra Evermist", async () => {
    await test.step("Click on Characters", async () => {
      await page.getByTestId("characters-tab").click();
    });

    await test.step("Click on +", async () => {
      await page.getByRole("button", { name: "New", exact: true }).click();
    });

    await test.step("Create new Character", async () => {
      await page.getByRole("textbox", { name: "Character name..." }).fill("Lyra Evermist");
      await page.getByRole("button", { name: "Create", exact: true }).click();
    });

    await test.step("Upload Character Avatar", async () => {
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.getByRole("button", { name: "Upload avatar" }).click(),
      ]);

      await fileChooser.setFiles("tests/story-bundle/data/happy-path/lyra-evermist.webp");
    });

    await test.step("Enter creator name", async () => {
      await page.getByTestId("character-editor-metadata-creator-input").fill("Aster Vale");
    });

    await test.step("Add Tags", async () => {
      await page.getByTestId("character-editor-metadata-tag-input").fill("Academy");
      await page.keyboard.press("Enter");

      await page.getByTestId("character-editor-metadata-tag-input").fill("School");
      await page.keyboard.press("Enter");
    });

    await test.step("Switch to Card Tab", async () => {
      await page.getByTestId("character-editor-tab-card").click();
    });

    await test.step("Add Character Prompt", async () => {
      await page.getByTestId("character-editor-card-description-textarea")
        .fill(`Lyra Evermist is a talented young mage from the northern kingdom of Avelia. She has long silver-blue hair, violet eyes, and a calm, elegant appearance that often makes her seem more confident than she actually is. She usually wears the dark blue and white uniform of the Arcane Academy, decorated with a small silver emblem representing her elemental affinity.
                Lyra was raised by her grandmother in a quiet village far from the capital. From an early age, she showed an unusual talent for elemental magic, particularly ice and wind. Her abilities earned her a place at the Academy, where she quickly became known as one of the most promising students in her year.
                Despite her impressive magical abilities, Lyra is not arrogant. She is thoughtful, curious, and usually polite, but she can become stubborn when someone questions her abilities. She enjoys studying ancient magic, exploring the Academy grounds, drinking tea, and listening to stories about distant kingdoms. She dislikes unnecessary conflict, people who abuse their power, and being treated as fragile because of her quiet personality.
                Lyra secretly worries that her talent is the only reason people value her. She wants to make genuine friends and discover what kind of person she wants to become rather than simply living up to the expectations placed upon her.
                Lyra is currently a student at the Arcane Academy and has just begun her second year. She is excited about the new school year, although she has heard rumors about strange events occurring beyond the old eastern gate.`);
    });

    await test.step("Save Character", async () => {
      await page.getByTestId("character-editor-save-button").click();

      // Capture the id of the character created in this run. The list is
      // ordered by most recently updated, so the first name match is ours.
      const response = await page.request.get("/api/characters");
      expect(response.ok()).toBe(true);
      const list = (await response.json()) as Array<{ id: string; data: string | { name?: string } | null }>;
      const created = list.find((char) => {
        const parsed = typeof char.data === "string" ? (JSON.parse(char.data) as { name?: string } | null) : char.data;
        return parsed?.name === "Lyra Evermist";
      });
      expect(created, "created character should be listed by the API").toBeDefined();
      characters.push({ id: created!.id, name: "Lyra Evermist" });
    });

    await test.step("Download and Import Online Character", async () => {
      await test.step("Back to character list", async () => {
        // On mobile the editor is a full-screen view that hides the list's
        // Download button; go back to the list first (no-op on desktop
        // layouts where both stay visible).
        await page.getByTestId("character-editor-back-button").click();
      });

      await test.step("Click on Download", async () => {
        await page.getByRole("button", { name: "Download", exact: true }).click();
      });

      await test.step("Click on a random Character and import it", async () => {
        // Only draw from the first cards of the result page. Some upstream
        // cards fail to download (the import dialog then stays open and an
        // error toast appears), so retry with the next card in that case.
        const cards = page.locator('[data-component="BotBrowserView"] .grid > button');
        // The upstream card index intermittently fails its first request and
        // renders a "Search failed" state with a Retry button; under full
        // suite load the request can also simply hang while the view keeps
        // spinning, in which case the toolbar Refresh button re-issues the
        // search.
        const retrySearch = page.getByRole("button", { name: "Retry", exact: true });
        const refreshSearch = page.getByRole("button", { name: "Refresh", exact: true });
        for (let searchAttempt = 0; ; searchAttempt++) {
          const loaded = await cards
            .first()
            .waitFor({ state: "visible", timeout: 20_000 })
            .then(() => true)
            .catch(() => false);
          if (loaded) break;
          expect(searchAttempt, "card search should recover after a retry").toBeLessThan(3);
          if (await retrySearch.isVisible().catch(() => false)) {
            await retrySearch.click();
          } else {
            await refreshSearch.click();
          }
        }
        const poolSize = Math.min(await cards.count(), 20);
        expect(poolSize).toBeGreaterThan(0);

        const importDialog = page.getByRole("dialog", { name: "Import Card" });
        const errorToast = page.locator('li[data-sonner-toast][data-type="error"]');
        const startIndex = Math.floor(Math.random() * poolSize);
        const maxAttempts = Math.min(poolSize, 5);
        let imported = false;

        // Snapshot existing character ids so the imported card's id can
        // be detected by diffing after a successful import.
        const beforeResponse = await page.request.get("/api/characters");
        expect(beforeResponse.ok()).toBe(true);
        const beforeIds = new Set(((await beforeResponse.json()) as Array<{ id: string }>).map((char) => char.id));

        for (let attempt = 0; attempt < maxAttempts && !imported; attempt++) {
          await cards.nth((startIndex + attempt) % poolSize).click();

          // Capture the card's name from the detail view. Other mobile tests
          // create characters concurrently on the shared mobile server, so a
          // plain id diff can pick up a foreign character; the name pins the
          // diff to this test's card.
          const cardName = (
            (await page
              .getByRole("heading", { level: 3 })
              .first()
              .textContent()
              .catch(() => null)) ?? ""
          ).trim();

          // The detail view's green Import button opens the Import Card dialog.
          const importButton = page.getByText("Import", { exact: true });
          await importButton.waitFor({ state: "visible" });
          await importButton.click();
          await importDialog.waitFor({ state: "visible" });
          await page.getByRole("button", { name: "Import as Character Add this" }).click();

          // Cards with an embedded lorebook show a second stage asking
          // whether to import it as a standalone lorebook. Decline so the
          // flow stays character-only, then let the import finish.
          const noImportButton = page.getByRole("button", { name: "No Import", exact: true });
          const sawLorebookPrompt = await noImportButton
            .waitFor({ state: "visible", timeout: 5_000 })
            .then(() => true)
            .catch(() => false);
          if (sawLorebookPrompt) await noImportButton.click();

          const outcome = await Promise.race([
            importDialog.waitFor({ state: "detached", timeout: 20_000 }).then(() => "imported"),
            errorToast
              .first()
              .waitFor({ state: "visible", timeout: 20_000 })
              .then(() => "failed"),
          ]);

          if (outcome === "imported") {
            imported = true;

            // Capture the imported card's id. Prefer matching the card name
            // captured above (names live inside the JSON `data` column): a
            // plain id diff can pick up a foreign character created in
            // parallel by another test on the shared server, and such a
            // character still exists in the picker's data but was never
            // meant for this run.
            const afterResponse = await page.request.get("/api/characters");
            expect(afterResponse.ok()).toBe(true);
            const afterList = (await afterResponse.json()) as Array<{
              id: string;
              data: string | { name?: string } | null;
            }>;
            const nameOf = (char: { data: string | { name?: string } | null }) => {
              try {
                const parsed =
                  typeof char.data === "string" ? (JSON.parse(char.data) as { name?: string } | null) : char.data;
                return typeof parsed?.name === "string" ? parsed.name.trim() : "";
              } catch {
                return "";
              }
            };
            const importedCharacter =
              afterList.find((char) => cardName !== "" && nameOf(char) === cardName && !beforeIds.has(char.id)) ??
              afterList.find((char) => !beforeIds.has(char.id));
            expect(importedCharacter, "imported character should appear in the API").toBeDefined();
            characters.push({ id: importedCharacter!.id, name: cardName });
          } else {
            // On failure the dialog stays open and the error toast
            // intercepts pointer events. Escape dismisses the dialog
            // regardless of the toast; then let the toast fade.
            await page.keyboard.press("Escape");
            await importDialog.waitFor({ state: "detached", timeout: 5_000 });
            await errorToast
              .last()
              .waitFor({ state: "detached", timeout: 8_000 })
              .catch(() => {});
            await page.getByRole("button", { name: "Back to results" }).click();
          }
        }

        expect(imported, "at least one online card should import").toBe(true);
      });
    });

    // PERSONA
    await test.step("Create a new Persona", async () => {
      await test.step("Click on Personas", async () => {
        await page.getByTestId("personas-tab").click();
      });

      await test.step("Click on +", async () => {
        await page.getByRole("button", { name: "New", exact: true }).click();
      });

      await test.step("Create new Persona", async () => {
        await page.getByRole("textbox", { name: "Name *" }).fill("Aiden Vale");
        await page.getByRole("button", { name: "Create", exact: true }).click();
      });

      await test.step("Upload Persona Avatar", async () => {
        const [fileChooser] = await Promise.all([
          page.waitForEvent("filechooser"),
          page.getByRole("button", { name: "Upload avatar" }).click(),
        ]);

        await fileChooser.setFiles("tests/story-bundle/data/happy-path/aiden-vale.webp");
      });

      await test.step("Enter creator name", async () => {
        await page.getByTestId("persona-editor-metadata-creator-input").fill("Aster Vale");
      });

      await test.step("Switch to Description Tab", async () => {
        await page.getByTestId("persona-editor-tab-card").click();
      });

      await test.step("Add Character Prompt", async () => {
        await page.getByTestId("persona-editor-card-description-textarea")
          .fill(`Kael Arden is a young student at the Arcane Academy with tousled black hair, striking blue eyes, and a calm, composed presence that often makes him appear more confident than he actually feels. He usually wears the academy's dark navy uniform beneath a blue cloak decorated with the school's crest, giving him a refined but understated appearance.
                Kael comes from a modest family with no famous magical bloodline or political influence. Unlike many students at the Academy, he was admitted because of his own aptitude rather than his family's reputation. His natural talent lies in defensive and enhancement magic, though he has spent considerable time studying swordsmanship as well.
                Quiet and observant, Kael prefers to listen before speaking and rarely seeks attention. He is intelligent, practical, and surprisingly stubborn once he has committed himself to something. He dislikes arrogance, unnecessary cruelty, and people who judge others solely by their social standing. Although he can appear distant at first, Kael is loyal to those he considers friends and has a dry sense of humor that occasionally catches people off guard.
                Kael is fascinated by the history of the Academy and the mysterious ruins surrounding its grounds. He spends much of his free time in the library researching old magical texts, although he occasionally sneaks away from his studies to explore places students are not supposed to visit.
                As a new student at the Academy, Kael is determined to prove that his lack of noble connections does not make him inferior to those born into powerful families. He does not yet know that the strange events surrounding the eastern gate may soon draw him into something far greater than an ordinary school year.
                [I take the role of {{user}}, do not write {{user}}'s actions or dialogue in your replies.]`);
      });

      await test.step("Save Persona", async () => {
        await page.getByTestId("persona-editor-save-button").click();

        // Capture the id of the persona created in this run.
        const response = await page.request.get("/api/characters/personas/list");
        expect(response.ok()).toBe(true);
        const personas = (await response.json()) as Array<{ id: string; name: string }>;
        const created = personas.find((entry) => entry.name === "Aiden Vale");
        expect(created, "created persona should be listed by the API").toBeDefined();
        persona = created!.id;
      });
    });
  });

  // LOREBOOKS
  await test.step("Create a new Lorebook", async () => {
    await test.step("Click on Lorebooks", async () => {
      await page.getByTestId("lorebooks-tab").click();
    });

    await test.step("Click on +", async () => {
      await page.getByRole("button", { name: "New", exact: true }).click();
    });

    await test.step("Create new Lorebook", async () => {
      await page.getByRole("textbox", { name: "Name *" }).fill("The Academy beyond the Gate - World");
      await page
        .getByRole("textbox", { name: "Description" })
        .fill("A lorebook containing information about the Arcane Academy and its surrounding world.");
      await page.getByLabel("CategoryWorldCharacterNPCSpellbookOther").selectOption("world");
      await page.getByRole("button", { name: "Create Lorebook", exact: true }).click();
    });

    await test.step("Open the created Lorebook", async () => {
      // Creating only closes the modal the editor does not open
      // automatically. Resolve the new lorebook's id via the API and
      // click its row (data-testid="lorebook-row-${id}") to open it.
      const response = await page.request.get("/api/lorebooks");
      expect(response.ok()).toBe(true);
      const lorebooks = (await response.json()) as Array<{ id: string; name: string }>;
      const created = lorebooks.find((lb) => lb.name === "The Academy beyond the Gate - World");
      expect(created, "created lorebook should be listed by the API").toBeDefined();
      lorebook.push(created!.id);
      await page.getByTestId(`lorebook-row-${created!.id}`).click();
    });

    await test.step("Add Lorebook Description", async () => {
      await page.getByTestId("lorebook-editor-description-textarea")
        .fill(`The Arcane Academy is a prestigious institution located in the northern kingdom of Avelia, renowned for its rigorous magical curriculum and its history of producing some of the most skilled mages in the realm. The Academy is situated on a sprawling campus that includes ancient libraries, enchanted gardens, and training grounds where students can practice their craft.
                Founded centuries ago by a council of powerful sorcerers, the Academy has always been a place where knowledge and magical talent are nurtured. Students from all over the kingdom, and even from distant lands, come to study here, drawn by the promise of mastering the arcane arts.
                The Academy's curriculum is diverse, covering elemental magic, alchemy, enchantments, and magical theory. Students are encouraged to explore their unique talents and are often paired with mentors who guide them through their studies. The Academy also hosts annual competitions and exhibitions where students can showcase their abilities.
                Beyond academics, the Academy is known for its rich traditions and ceremonies, which foster a sense of community among students and faculty alike. The school year is marked by various events, including magical duels, scholarly debates, and cultural festivals that celebrate the history and diversity of magic.
                However, the Academy is not without its mysteries. Rumors persist about hidden chambers, ancient artifacts, and secret societies that operate within its walls. Some say that the eastern gate of the Academy leads to forgotten realms and that only those with exceptional skill and courage can uncover its secrets.
                As a student at the Arcane Academy, one must be prepared to face challenges, both academic and personal, while striving to unlock the full potential of their magical abilities. The journey is demanding, but for those who persevere, the rewards are immeasurable.`);
    });

    await test.step("Add Tags", async () => {
      await page.getByTestId("lorebook-editor-tag-input").fill("Academy");
      await page.keyboard.press("Enter");

      await page.getByTestId("lorebook-editor-tag-input").fill("School");
      await page.getByTestId("lorebook-editor-tag-add-button").click();
    });

    await test.step("Switch to entry tab", async () => {
      await page.getByTestId("lorebook-editor-tab-entries").click();
    });

    await test.step("Add Lorebook Entry", async () => {
      await page.getByTestId("lorebook-editor-add-entry-button").click();
      await page.getByTestId("lorebook-editor-entry-name-input").fill("The Eastern Gate");
      await page.getByTestId("lorebook-editor-entry-content-textarea")
        .fill(`The Eastern Gate of the Arcane Academy is a mysterious and ancient portal that has long been the subject of speculation and legend 
                among students and faculty alike. Unlike the main entrance, which is grand and welcoming, the Eastern Gate is shrouded in an aura of secrecy, 
                with intricate runes etched into its stone frame that seem to shimmer faintly in the moonlight.`);
    });

    await test.step("Save Lorebook", async () => {
      await page.getByTestId("lorebook-editor-save-button").click();
    });
  });

  // AGENTS
  await test.step("Download Agents", async () => {
    await test.step("Click on Agents Tab", async () => {
      await page.getByTestId("topbar-panel-button-agents").click();
    });
    await test.step("Click on Download Agents", async () => {
      await page.getByTestId("agent-download-button").click();
    });

    // Installs are idempotent: when a previous run already installed an
    // agent, its detail view shows Uninstall instead of Install.
    const ensureAgentInstalled = async (itemId: string) => {
      const catalog = page.getByTestId("agent-library");
      if (!(await catalog.isVisible().catch(() => false))) {
        // The catalog may already be opening (lazy chunk load, drawer exit
        // animation), which unmounts the panel button mid-click; tolerate
        // that and simply wait for the catalog to appear.
        await page
          .getByTestId("agent-download-button")
          .click({ timeout: 3_000 })
          .catch(() => {});
        await expect(catalog).toBeVisible({ timeout: 15_000 });
      }
      const item = page.getByTestId(`agent-catalog-item-${itemId}`);
      // On mobile the catalog swaps to a full-screen detail view that hides
      // the item list; the "All agents" back button returns to the list.
      // (The header's "Back to Agents" button would close the catalog.)
      const backToList = page.getByRole("button", { name: "All agents", exact: true });
      if (await backToList.isVisible().catch(() => false)) {
        await backToList.click();
      }
      await expect(item).toBeVisible();
      await item.click();
      const installButton = page.getByTestId("agent-catalog-agent-install-button");
      const uninstallButton = page.getByTestId("agent-catalog-agent-uninstall-button");
      const state = await Promise.race([
        installButton.waitFor({ state: "visible", timeout: 15_000 }).then(() => "installable"),
        uninstallButton.waitFor({ state: "visible", timeout: 15_000 }).then(() => "installed"),
      ]);
      if (state === "installable") await installButton.click();
      agents.push(itemId);
    };

    await test.step("Install Continuity Checker Agent", async () => {
      await ensureAgentInstalled("continuity");
    });
    await test.step("Install World State Agent", async () => {
      await ensureAgentInstalled("world-state");
    });
    await test.step("Install Prose Guardian Agent", async () => {
      await ensureAgentInstalled("prose-guardian");
    });
    await test.step("Install Character Tracker Agent", async () => {
      await ensureAgentInstalled("character-tracker");
    });
  });

  // PRESET
  await test.step("Resolve pre installed Marinara preset", async () => {
    const response = await page.request.get("/api/prompts");
    expect(response.ok()).toBe(true);
    const presets = (await response.json()) as Array<{ id: string; name: string }>;
    const universal = presets.find((entry) => entry.name === "Marinara's Universal Preset");
    expect(universal, "stock Marinara universal preset should be seeded").toBeDefined();
    preset = universal!.id;
  });

  // STORY BUNDLE FLOW
  await test.step("Create story bundle", async () => {
    await page.getByTestId("topbar-panel-button-story-bundles").click();
    await page.getByTestId("story-bundles-create-button").click();
    await page.getByTestId("app-dialog-prompt-input").fill("The Academy beyond the Gate");
    await page.getByTestId("app-dialog-confirm-button").click();
  });

  await test.step("Enter story bundle comment", async () => {
    await page
      .getByTestId("story-bundle-editor-metadata-comment-input")
      .fill("A complete story setup with characters, lore, and everything needed to get started");
  });

  await test.step("Enter creator name", async () => {
    await page.getByTestId("story-bundle-editor-metadata-creator-input").fill("Aster Vale");
  });

  await test.step("Enter story bundle tags", async () => {
    await page.getByTestId("story-bundle-editor-metadata-tag-input").fill("academy");
    await page.keyboard.press("Enter");

    await page.getByTestId("story-bundle-editor-metadata-tag-input").fill("school");
    await page.keyboard.press("Enter");
  });

  await test.step("Upload story bundle image", async () => {
    const fileChooserPromise = page.waitForEvent("filechooser");

    await page.getByTestId("story-bundle-editor-metadata-upload-button").click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles("tests/story-bundle/data/happy-path/the-academy-beyond-the-gate.webp");
  });

  await test.step("Switch to Description Tab", async () => {
    await page.getByTestId("story-bundle-editor-tab-description").click();
  });

  await test.step("Enter story bundle description", async () => {
    await page.getByTestId("story-bundle-editor-description-preview-toggle").click();
    await page.getByTestId("story-bundle-editor-description-input").fill(`
            <div style="background:linear-gradient(135deg,#17152f 0%,#29205a 55%,#3b2b73 100%);color:#fff;font-family:Arial,sans-serif;padding:20px;border-radius:12px;box-shadow:0 8px 24px rgba(32,20,70,.35);line-height:1.55;">
            <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#cfc4ff;margin-bottom:6px;">
                ✦ Welcome to the Academy ✦
            </div>
            <div style="font-size:25px;font-weight:900;line-height:1.15;margin-bottom:8px;">
                The Academy Beyond the Gate
            </div>
            <div style="height:2px;background:linear-gradient(90deg,#f6d77a,#b99cff,transparent);margin:10px 0 16px;"></div>
            <div style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);padding:12px 14px;border-radius:8px;margin-bottom:14px;">
                <div style="font-size:15px;font-weight:700;color:#f6d77a;margin-bottom:4px;">
                ✨ Your journey begins here.
                </div>
                <div style="font-size:13px;color:#eee9ff;">
                Chosen students from across the kingdom gather here to master their abilities, uncover forgotten secrets and find their place in a world filled with possibilities.
                </div>
            </div>
            <p style="font-size:13px;color:#eee9ff;margin:0 0 10px;">
                Classes will be formed, friendships will be tested, and unexpected adventures await beyond the classroom.
            </p>
            <p style="font-size:13px;color:#eee9ff;margin:0;">
                <span style="color:#f6d77a;font-weight:700;">Your story starts the moment you walk through the gate.</span>
            </p>
            </div>
        `);
    await page.getByTestId("story-bundle-editor-description-preview-toggle").click();
  });

  await test.step("Add created characters", async () => {
    await page.getByTestId("story-bundle-editor-tab-characters").click();

    // Use the ids captured during creation/import of this run. The picker
    // paginates (20 rows per page), so on a busy shared storage our entries
    // could sit past the first page and their add button would never
    // render; narrow the list with this run's unique names first.
    expect(characters.length, "created and imported character ids should exist").toBeGreaterThan(0);
    const characterSearch = page.getByTestId("story-bundle-editor-characters-search");
    for (const character of characters) {
      await characterSearch.fill(character.name);
      const addButton = page.getByTestId(`story-bundle-editor-characters-add-${character.id}`);
      await addButton.scrollIntoViewIfNeeded();
      await addButton.click();
      await characterSearch.fill("");
    }

    // The imported card's name is random, so only assert the known one is selected.
    await expect(page.getByTestId("story-bundle-editor-characters-selected")).toContainText("Lyra Evermist");
  });

  await test.step("Add created persona", async () => {
    await page.getByTestId("story-bundle-editor-tab-personas").click();

    // Use the persona id captured during creation of this run.
    expect(persona, "persona id should have been captured").toBeDefined();
    await page.getByTestId(`story-bundle-editor-personas-add-${persona!}`).click();
    await expect(page.getByTestId("story-bundle-editor-personas-selected")).toContainText("Aiden Vale");
  });

  await test.step("Add pre installed marinara preset", async () => {
    await page.getByTestId("story-bundle-editor-tab-presets").click();

    // Use the preset id resolved earlier in this run.
    expect(preset, "preset id should have been captured").toBeDefined();
    await page.getByTestId(`story-bundle-editor-presets-add-${preset!}`).click();
    await expect(page.getByTestId("story-bundle-editor-presets-selected")).toContainText("Marinara's Universal Preset");
  });

  await test.step("Add created lorebook", async () => {
    await page.getByTestId("story-bundle-editor-tab-lorebooks").click();

    // Use the lorebook id captured during creation of this run.
    expect(lorebook.length, "lorebook id should have been captured").toBeGreaterThan(0);
    for (const lorebookId of lorebook) {
      await page.getByTestId(`story-bundle-editor-lorebooks-add-${lorebookId}`).click();
    }
    await expect(page.getByTestId("story-bundle-editor-lorebooks-selected")).toContainText(
      "The Academy beyond the Gate - World",
    );
  });

  await test.step("Add installed agents", async () => {
    await page.getByTestId("story-bundle-editor-tab-agents").click();

    // The agent list loads asynchronously (install detection); wait until the
    // loading state is gone before clicking the id-based add buttons.
    await expect(page.getByTestId("story-bundle-editor-agents-loading")).toHaveCount(0);

    // Use the ids of the agents installed earlier in this run.
    expect(agents.length, "installed agent ids should have been captured").toBe(4);
    for (const agentId of agents) {
      await page.getByTestId(`story-bundle-editor-agents-add-${agentId}`).click();
    }

    await expect(page.locator('[data-testid^="story-bundle-editor-agents-remove-"]')).toHaveCount(agents.length);
  });

  await test.step("Save story bundle", async () => {
    await page.getByTestId("story-bundle-editor-save-button").click();
  });

  // START THE STORY BUNDLE AND VERIFY THE CHAT CONFIGURATION
  await test.step("Start story bundle roleplay", async () => {
    await test.step("Play the saved story bundle", async () => {
      await page.getByTestId("story-bundle-editor-play-button").click();
    });

    await test.step("Confirm preset choices", async () => {
      const dialog = page.getByRole("dialog", { name: "Configure Preset Variables" });
      await expect(dialog).toBeVisible();

      // Pick the Roleplayer option of the {{role}} choice block.
      await dialog.getByRole("button", { name: /^Roleplayer/ }).click();

      await dialog.getByRole("button", { name: "Confirm Choices" }).click();
      await expect(dialog).toBeHidden();
    });

    await test.step("Close the story bundles panel", async () => {
      // On mobile the right panel overlays the new chat as a full-screen
      // sheet; close it so the chat toolbar becomes reachable. On desktop
      // the panel sits beside the chat, so closing it is a harmless no-op.
      const closePanel = page.getByRole("button", { name: "Close panel", exact: true });
      if (await closePanel.isVisible().catch(() => false)) await closePanel.click();
    });
  });

  await test.step("Verify story configuration in chat settings", async () => {
    const drawer = page.getByTestId("chat-settings-drawer");

    // Expands a chat settings section if it is collapsed. Item rows only
    // exist in the DOM while their section is open.
    const expandSection = async (sectionId: string) => {
      const header = page.getByTestId(`chat-settings-section-${sectionId}`);
      await header.scrollIntoViewIfNeeded();
      if ((await header.getAttribute("aria-expanded")) === "false") {
        await header.click();
      }
      await expect(header).toHaveAttribute("aria-expanded", "true");
    };

    await test.step("Open chat settings", async () => {
      // Confirming the preset choices should auto-open the settings
      // panel; click the toolbar button if it did not.
      const autoOpened = await drawer
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (!autoOpened) {
        const settingsButton = page.getByRole("button", { name: "Chat Settings", exact: true });
        // On mobile the settings button collapses into the toolbar's
        // "More options" overflow menu; open it first when needed.
        if (!(await settingsButton.isVisible().catch(() => false))) {
          await page.getByRole("button", { name: "More options", exact: true }).click();
        }
        await settingsButton.click();
      }
      await expect(drawer).toBeVisible();
    });

    await test.step("Verify characters", async () => {
      await expandSection("roleplay-characters");

      const ids = await page
        .locator('[data-testid^="chat-settings-character-"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid") ?? ""));

      expect(ids.map((id) => id.replace("chat-settings-character-", "")).sort()).toEqual(
        characters.map((char) => char.id).sort(),
      );
    });

    await test.step("Verify persona", async () => {
      await expandSection("roleplay-persona");

      expect(persona, "persona id should have been captured").toBeDefined();
      await expect(page.locator('[data-testid^="chat-settings-persona-"]')).toHaveCount(1);
      await expect(page.getByTestId(`chat-settings-persona-${persona!}`)).toBeVisible();
    });

    await test.step("Verify lorebook", async () => {
      await expandSection("lorebooks");

      expect(lorebook.length, "lorebook ids should have been captured").toBeGreaterThan(0);
      await expect(page.locator('[data-testid^="chat-settings-lorebook-"]')).toHaveCount(lorebook.length);
      for (const lorebookId of lorebook) {
        await expect(page.getByTestId(`chat-settings-lorebook-${lorebookId}`)).toBeVisible();
      }
    });

    await test.step("Verify preset", async () => {
      await expandSection("prompt-preset");

      expect(preset, "preset id should have been captured").toBeDefined();
      await expect(page.getByTestId(`chat-settings-preset-${preset!}`)).toBeVisible();
    });

    await test.step("Verify agents", async () => {
      await expandSection("roleplay-agents");

      // Agent entries sit inside collapsed category sections (Writer /
      // Tracker / Misc / Custom); expand every collapsed one.
      const collapsedCategories = page.locator(
        '[data-testid^="chat-settings-agents-category-"][aria-expanded="false"]',
      );
      while ((await collapsedCategories.count()) > 0) {
        await collapsedCategories.first().click();
      }

      const ids = await page
        .locator('[data-testid^="chat-settings-agent-"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid") ?? ""));

      expect(ids.map((id) => id.replace("chat-settings-agent-", "")).sort()).toEqual([...agents].sort());
    });
  });
});

// await test.step('Configure story bundle', async () => {
//     // Add all objects
//     // Configure intro
//     // Configure agents
// });

// await test.step('Start story', async () => {
//     // Actual Play
// });

// await test.step('Verify complete story configuration', async () => {
//     // Settings
//     // Verify Characters
//     // Persona
//     // Preset
//     // Lorebook
//     // Agents
// });

// await page.goto('http://127.0.0.1:7860/');
// await page.getByRole('button', { name: 'Got it' }).click();

// await page.getByTestId('story-bundle-editor-metadata-tag-input').fill('bundle');
// await page.getByTestId('story-bundle-editor-metadata-tag-add-button').click();
// await expect(page.getByTestId('story-bundle-editor-metadata-tag-first')).toBeVisible();
// await expect(page.getByTestId('story-bundle-editor-metadata-tag-bundle')).toBeVisible();
// await page.getByTestId('story-bundle-editor-tab-description').click();
// await page.getByTestId('story-bundle-editor-description-preview-toggle').click();
// await page.getByTestId('story-bundle-editor-description-preview').click();
// await page.getByTestId('story-bundle-editor-description-input').fill('My first Bundle');
// await expect(page.getByTestId('story-bundle-editor-description-preview')).toContainText('My first Bundle');
// await page.getByTestId('story-bundle-editor-tab-characters').click();
// await page.getByRole('button', { name: 'Characters', description: 'Characters' }).click();
// await page.getByRole('button', { name: 'New', exact: true }).click();
// await page.getByRole('textbox', { name: 'Character name...' }).click();
// await page.getByRole('textbox', { name: 'Character name...' }).fill('New Character for Bundle');
// await page.getByRole('button', { name: 'Create', exact: true }).click();
// await page.getByRole('button', { name: 'Back', description: 'Back' }).click();
// await page.getByRole('button', { name: 'Open Library' }).click();
// await page.getByRole('button', { name: 'Close library' }).click();
// await page.getByRole('button', { name: 'Characters' }).click();
// await page.getByRole('button', { name: 'Download', exact: true }).click();
// await page.getByRole('button', { name: 'Download', exact: true }).click();
// await page.getByRole('button', { name: 'Download', exact: true }).click();
// await page.getByRole('button', { name: 'Close panel' }).click();
// await page.getByRole('button', { name: 'Queen Elara Queen Elara by' }).click();
// await page.getByRole('button', { name: 'Import' }).click();
// await page.getByRole('button', { name: 'Import as Character Add this' }).click();
// await page.getByRole('button', { name: 'Close library' }).click();
// await page.getByTestId('topbar-panel-button-story-bundles').click();
// await page.getByTestId('story-bundle-row-0E6CcXC80E7zrnBURQb6J').click();
// await page.getByTestId('story-bundle-editor-tab-personas').click();
// await page.getByTestId('story-bundle-editor-tab-characters').click();
// await page.getByTestId('story-bundle-editor-characters-add-4x6TzHgpzgN4laaNXysh5').click();
// await page.getByTestId('story-bundle-editor-characters-add-7ujBmYTWcKQ0uPr1FYUmU').click();
// await page.getByTestId('story-bundle-editor-tab-personas').click();
// await page.getByTestId('topbar-panel-button-personas').click();
// await page.getByRole('button', { name: 'New', exact: true }).click();
// await page.getByRole('textbox', { name: 'Name *' }).fill('My Story Bundle Persona');
// await page.getByRole('button', { name: 'Create', exact: true }).click();
// await page.getByTestId('topbar-panel-button-story-bundles').click();
// await page.getByTestId('story-bundle-row-0E6CcXC80E7zrnBURQb6J').click();
// await page.getByTestId('story-bundle-editor-tab-personas').click();
// await page.getByTestId('story-bundle-editor-personas-add-b0hnfZVFn7tHvdEOd4DD3').click();
// await page.getByTestId('story-bundle-editor-tab-characters').click();
// await page.getByTestId('story-bundle-editor-characters-add-4x6TzHgpzgN4laaNXysh5').click();
// await page.getByTestId('story-bundle-editor-characters-add-7ujBmYTWcKQ0uPr1FYUmU').click();
// await page.getByTestId('story-bundle-editor-tab-personas').click();
// await page.getByTestId('story-bundle-editor-tab-characters').click();
// await page.getByTestId('story-bundle-editor-tab-personas').click();
// await page.getByTestId('story-bundle-editor-tab-lorebooks').click();
// await page.getByTestId('story-bundle-editor-save-button').click();
// await page.getByTestId('topbar-panel-button-lorebooks').click();
// await page.getByRole('button', { name: 'New', exact: true }).click();
// await page.getByRole('textbox', { name: 'Name *' }).fill('Lorebook for Bundle');
// await page.getByRole('button', { name: 'Create Lorebook', exact: true }).click();
// await page.getByTestId('topbar-panel-button-story-bundles').click();
// await page.getByTestId('story-bundle-row-0E6CcXC80E7zrnBURQb6J').click();
// await page.getByTestId('story-bundle-editor-lorebooks-add-RogxybTdlpK6XN__jb54E').click();
// await page.getByTestId('story-bundle-editor-save-button').click();
// await page.getByTestId('story-bundle-editor-tab-presets').click();
// await page.getByTestId('story-bundle-editor-presets-add-ZtjsYdyS3jDo-T-tZTDX0').click();
// await page.getByTestId('story-bundle-editor-save-button').click();
// await page.getByTestId('story-bundle-editor-tab-agents').click();
// await page.getByTestId('story-bundle-editor-agents-add-continuity').click();
// await page.getByTestId('story-bundle-editor-agents-add-world-state').click();
// await page.getByTestId('story-bundle-editor-agents-add-prose-guardian').click();
// await page.getByTestId('story-bundle-editor-agents-add-character-tracker').click();
// await page.getByTestId('story-bundle-editor-save-button').click();
// await page.getByTestId('story-bundle-editor-tab-intros').click();
// await page.getByTestId('story-bundle-editor-intros-add-button').click();
// await page.getByTestId('story-bundle-editor-intros-name-input').fill('My first Intro');
// await page.getByTestId('story-bundle-editor-intros-text-input').click();
// await page.getByTestId('story-bundle-editor-intros-text-input').fill('Hello!');
// await page.getByTestId('story-bundle-editor-intros-save-button').click();
// await page.getByTestId('story-bundle-editor-save-button').click();
// await page.getByTestId('story-bundle-editor-play-button').click();
// await expect(page.getByLabel('Choose an Intro', { exact: true })).toContainText('My first Intro');
// await page.getByRole('button', { name: 'My first Intro' }).click();
// await page.getByRole('button', { name: 'Roleplayer {{char}}, a real' }).click();
// await page.getByRole('button', { name: 'Game Master an excellent Game' }).click();
// await page.getByRole('button', { name: 'Confirm Choices' }).click();
// await page.getByRole('button', { name: 'Home' }).click();
// await page.getByRole('button', { name: 'Chats', exact: true }).click();
// await page.getByRole('button', { name: 'Drag chat Elara N My first' }).click();
// await page.getByRole('button', { name: 'Drag chat Elara N My first' }).click();
// await page.getByRole('button', { name: 'Close chats' }).click();
// await page.getByRole('button', { name: 'Chat Settings' }).click();
// await page.getByRole('button', { name: 'Prompt Preset Show help' }).click();
// await page.getByRole('button', { name: 'Connection Show help' }).click();
// await page.getByRole('button', { name: 'Connection Show help' }).click();
// await page.getByRole('button', { name: 'Connection Show help' }).click();
// await page.getByRole('button', { name: 'Prompt Preset Show help' }).click();
// await page.getByRole('button', { name: 'Chat Settings' }).click();
// await page.getByRole('button', { name: 'Chat Settings' }).click();
// await page.getByRole('button', { name: 'Prompt Preset Show help' }).click();
// await page.getByRole('button', { name: 'Prompt Preset Show help' }).click();
// });
