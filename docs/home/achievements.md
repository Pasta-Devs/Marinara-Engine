# Achievements

This guide explains the Achievements feature in Marinara Engine. Achievements are cosmetic badges that unlock as you use the app. This guide covers where to find them, the full list, the on/off setting, and how unlocking works.

## What achievements are

Achievements are small collectible badges. Marinara Engine unlocks them in the background as you do normal things, like creating chats, characters, or personas, or visiting community links.

Achievements are purely cosmetic. They do not unlock features and they do not change how the app behaves. They are just a fun way to track what you have done.

Your progress is saved locally, inside the profile you are using. A different profile or a fresh install starts with nothing unlocked. Because the records are stored with your other profile data, they travel with a full profile backup.

## Opening the Achievements panel

The **Achievements** bookmark lives on the Home screen. The Home screen is what you see when no chat is open. The bookmark sits in the row of bookmarks at the top, and it shows a trophy icon. On a phone, tap the bookmark button at the left of the tabs to find it.

You can also add the **Achievements** widget to Home. Click **Widgets** in the bookmarks and turn it on. The widget shows a live count, like **12 of 24 unlocked**, plus your **Last obtained** and **Closest next** achievements. While it is still loading, the count reads **Checking the collection...** instead. Click the widget to open the panel. See [Home widgets](welcome.md#home-widgets).

To open the panel, follow these steps:

1. Go to the Home screen.
2. Find the **Achievements** bookmark at the top.
3. Click it.

You should see the **Achievements** window open. At the top it shows a summary line, such as **12 of 24 achievements unlocked in this profile.** Below that is a grid of achievement cards.

Each card shows a badge icon, a title, a category label, and a short description. If a card is locked, the title reads **?????** and the icon is a lock. You cannot read what it is until you unlock it. Once you earn a card, it shows an **unlocked** tag. Cards with a target also show a **Progress** row and a progress bar.

The bookmark, the widget and the panel only appear when the **Achievements** setting is turned on. See the setting section below. There is no other menu or page that shows achievements.

## The 24 achievements

There are 24 achievements, split into four categories: **Milestone**, **Community**, **Creation**, and **Collection**.

Some achievements are single unlocks. The **Creation** and **Collection** ones are ranked, with three tiers marked **I**, **II**, and **III**. The tiers unlock at 5, then 25, then 100. So the badge title can read something like **Hoarder II** once you reach the second tier.

| Achievement | Category | How you unlock it |
|---|---|---|
| **Diligent Student** | Milestone | Finish or skip the first-time tutorial. |
| **Hello World** | Milestone | Send your first message to Professor Mari. |
| **Please Handle With Care** | Milestone | Drag Professor Mari's picture around the screen. |
| **One Of Us** | Community | Click the **Discord** bookmark or the **Discord** link in the **Community** widget on Home. |
| **Based Backer** | Community | Click **Support** (it opens Ko-fi) in the Home bookmarks or the **Community** widget. |
| **Backseat Appreciator** | Community | Click **Credits** in the Home bookmarks or the **Community** widget. |
| **Who Needs IRL Friends** | Creation | Create Conversation mode chats (5, 25, 100). |
| **They Feel Real To Me** | Creation | Create Roleplay chats (5, 25, 100). |
| **I Have No Other Hobbies** | Creation | Create Game mode chats (5, 25, 100). |
| **Hoarder** | Collection | Collect characters (5, 25, 100). |
| **The World's A Stage** | Collection | Collect lorebooks (5, 25, 100). |
| **I Am A Gamer** | Collection | Collect personas (5, 25, 100). |

A few notes on the list:

- A persona is the profile that represents you in a chat. A lorebook is a set of background notes the AI can pull in.
- The **Collection** achievements count everything of that type in your library. Imported and downloaded items count too, not just ones you build yourself. For **Hoarder**, the built-in Professor Mari character is the one exception: it never counts.
- For the community achievements, just visiting the link is enough. You do not need to sign up or finish anything on the other site.

## Achievements from agents

Installed agents can add achievements of their own. These show in the same **Achievements** window, after the built-in ones, under a heading such as **From Noodle**. The section only shows for agents that added achievements.

An agent's achievements follow the same rules as the built-in ones. They start locked, some have a progress bar, and you get the same pop-up notice when one unlocks. An agent can show its own badge art on unlocked cards.

If you remove an agent, its section goes away. Your unlocks are kept. If you install the agent again, its unlocked achievements show as unlocked again.

The count at the top of the window includes the achievements of the agents you have installed.

## The Achievements setting

You can turn the whole feature on or off with one toggle. Open **Settings**, go to the **General** tab, and find the **App Behavior** section. The toggle is labeled **Achievements**, and it is on by default.

Here is what the toggle does:

- On: the Home screen **Achievements** bookmark and the window are available, and you get a pop-up notice when something unlocks. The optional **Achievements** widget appears only if you added it to your Home layout.
- Off: the bookmark and widget are hidden and the pop-up notices stop. The app still records your unlocks quietly in the background.

Because tracking continues while the setting is off, your progress is not lost. If you turn the setting back on later, everything you earned in the meantime is already there.

## How unlocking works

Marinara checks the ranked achievements against your current live counts. This check runs when a tracked action happens, such as creating a chat or clicking a Home bookmark. It also runs when you open the Achievements panel.

When an action triggers an unlock and the setting is on, a small pop-up notice appears. Its title is **Achievement unlocked**, and it names the badge, for example **Hoarder II** or **One Of Us**.

Opening the panel can also unlock badges you already earned some other way. These catch-up unlocks are silent. The card just shows as unlocked, and no pop-up appears.

Once an achievement unlocks, it stays unlocked for good. This is true even if you later delete chats, characters, lorebooks, or personas and your count drops back down. The badge will not re-lock.

One thing to expect: the **Progress** bar on an already-unlocked card still shows your current live count. So a card can read something like **2 / 5** even though the badge is already earned. That is normal.

There is no button anywhere in the app to reset or clear your achievements.

## Related guides

- [Getting Started with Marinara Engine](welcome.md)
- [The First-Time Tutorial](tutorial.md)
- [Professor Mari, Your In-App Assistant](professor-mari.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
