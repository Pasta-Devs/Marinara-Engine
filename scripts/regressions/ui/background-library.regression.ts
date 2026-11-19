// The background library: folder organization drops invalid folders and assignments and follows a renamed or removed
// background, new folders get the next free name, and the picker filters by tag and sorts.
import assert from "node:assert/strict";
import {
  moveBackgroundAssignment,
  normalizeBackgroundLibraryOrganization,
  removeBackgroundFolder,
} from "../../../packages/server/src/services/background-library-organization.js";
import {
  filterAndSortBackgrounds,
  getNextBackgroundFolderName,
} from "../../../packages/client/src/lib/background-library.js";

const backgroundOrganization = normalizeBackgroundLibraryOrganization({
  folders: [
    {
      id: "folder-night",
      name: "Night",
      createdAt: "2026-07-16T00:00:00.000Z",
      updatedAt: "2026-07-16T00:00:00.000Z",
    },
    { id: "", name: "Invalid" },
  ],
  assignments: {
    "user:moonlit-garden.jpg": "folder-night",
    "game:backgrounds:fantasy:castle": "missing-folder",
  },
});
assert.equal(backgroundOrganization.folders.length, 1);
assert.equal(backgroundOrganization.assignments["user:moonlit-garden.jpg"], "folder-night");
assert.equal(backgroundOrganization.assignments["game:backgrounds:fantasy:castle"], undefined);
const renamedBackgroundOrganization = moveBackgroundAssignment(
  backgroundOrganization,
  "user:moonlit-garden.jpg",
  "user:moonlit-courtyard.jpg",
);
assert.equal(renamedBackgroundOrganization.assignments["user:moonlit-garden.jpg"], undefined);
assert.equal(renamedBackgroundOrganization.assignments["user:moonlit-courtyard.jpg"], "folder-night");
assert.deepEqual(removeBackgroundFolder(renamedBackgroundOrganization, "folder-night"), {
  folders: [],
  assignments: {},
  favorites: [],
});
assert.equal(getNextBackgroundFolderName([{ name: "Unnamed" }, { name: "unnamed 2" }]), "unnamed 3");
const backgroundLibraryFixtures = [
  {
    id: "user:forest.jpg",
    filename: "Forest.jpg",
    originalName: "Forest.jpg",
    tags: ["nature", "day"],
    source: "user" as const,
    createdAt: "2026-07-14T00:00:00.000Z",
  },
  {
    id: "game:backgrounds:modern:city-night",
    filename: "City Night.webp",
    originalName: "backgrounds:modern:city-night",
    tag: "backgrounds:modern:city-night",
    tags: ["modern", "night"],
    source: "game_asset" as const,
    createdAt: "2026-07-16T00:00:00.000Z",
  },
];
assert.deepEqual(
  filterAndSortBackgrounds(backgroundLibraryFixtures, {
    search: "",
    includedTags: new Set(["night"]),
    sort: "name-asc",
  }).map((background) => background.id),
  ["game:backgrounds:modern:city-night"],
);
assert.deepEqual(
  filterAndSortBackgrounds(backgroundLibraryFixtures, {
    search: "",
    includedTags: new Set(),
    sort: "newest",
  }).map((background) => background.id),
  ["game:backgrounds:modern:city-night", "user:forest.jpg"],
);
assert.equal(({} as { tags?: string[] }).tags, undefined, "Background metadata must not mutate Object.prototype");
