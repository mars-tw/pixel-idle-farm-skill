# App Review Notes — draft only

> 中文說明：這份是給 Apple 審查員看的英文操作說明草稿，內容對應 [DIFFERENTIATION.md](DIFFERENTIATION.md) 的「新玩家的前三分鐘」。狀態：只準備，沒有送出。內容對應原生 1.0.1 (8) 這一版，iOS 安裝檔還沒建置、上傳；不要附在更舊的版本上。

Status: PREPARED. These notes describe web build `content-r76-20261111-1` / package `0.1.99`, packaged locally on 11 November as native version 1.0.1 (8) from commit `23106b5`. The Android AAB/APK for build 8 is signed and verified locally. The iOS source bundle is prepared, but the IPA has NOT been built, signed or uploaded yet. Do not attach these notes to an older binary.

No account, purchase, advertisement or remote service is required to play. All gameplay described here is available to ordinary players; there is no reviewer-only content or mode.

## First three minutes

1. On a fresh launch, tap **去見鎮長葛瑞** (Go and meet Mayor Gary) on the opening note. The gold task card asks you to tap **種第一株小麥** (Plant the first wheat); the character walks to a plot and sows it.
2. A pulsing ring appears on the field. It is a forecast: sunlight will land on that plot about eight seconds later. If the ring is on an empty plot, the task card changes to **拿祖母的手鏡折光** (Use Grandma's hand mirror). Tap **把光折過來** (Bend the light over here) and the ring moves onto your wheat. Each beam can be redirected once (twice after the mirror upgrade at level 3).
3. When the light lands, tap **去光裡澆水** (Water in the light). Tending a crop inside the light catches one point of sunlight, stored in the sun jar shown at the top of the screen.
4. Wheat is a sun-loving crop, so tending it in the light yields one extra wheat. Tap **走近收成** (Walk over and harvest), then **裝好餐籃** (Pack the basket) and choose **留在門邊** (Leave it at the doorstep) or **一起坐下** (Sit together). Each choice leaves a different note from Grandma and a different reply from Gary.
5. Once the jar holds 2 points, the task card offers **用陽光催熟** (Ripen with sunlight): spend 2 sunlight to ripen one growing plot instantly. It then sends you back to the farmhouse stove. Cooking is a 12-second fire-tending game: **添柴** (Add wood) raises the heat, **掀蓋** (Lift the lid) lowers it; keeping the needle inside the gold zone gives a better dish (three grades). **直接做（家常）** skips the mini-game and gives the basic grade. A result card then shows the grade, how much of the time the needle stayed in the gold zone, and what that grade does. Tap **現在吃** (Eat now) to eat the flatbread, which completes chapter 1; **先放餐籃** (Keep it in the basket) saves it for later.

Players who tap **稍後再看便箋** (Read the note later) on the opening screen skip the basket step but are still taught the mirror, ripening and the stove.

Missing a beam never locks progress; another one is forecast later. Nothing in this route depends on a daily reset or consecutive logins.

Beyond the first session: crops have three light traits (sun-loving, half-sun, shade-tolerant) that reward different handling of the light; stored sunlight also powers a drying rack that turns crops into dried goods worth three times the raw crop; the three early story choices each leave a permanent difference on the farm, listed in the journal under **我做過的選擇** (Choices I made). Each of those three townspeople later refers back to the answer in a follow-up conversation, triggered after two of their orders are delivered or when the player talks to them on a later day; what they said is kept under **後來** (Afterwards) in the same journal section. The **追光手冊** (sun-chasing handbook) at the top of the journal's collection page records up to four kinds of stamp per crop: harvested in the light, light trait fulfilled, dried on the rack, and cooked to the top grade. Collecting 3, 6, 10 and 15 stamps each unlocks a reward; three of them are permanent (two enlarge the sun jar by one point each, one allows one more redirect per beam).

The route above was measured with an automated script in headless Chromium using real input and real elapsed time, on a new save, without granting crops, skipping growth or editing the save: 69 s (desktop), 63 s (phone layout), 62 s (skip path) to the first meal, no page errors. See `docs/evidence/r76/first-meal-playthrough.json`. A script taps faster than a person. This is not a claim about real-user beta testing or iOS device performance.

## Material changes and limits

Since the 15 October review the core loop changed from "wait for a random sun patch and react" to "see where the light will land, redirect it, decide which crop should receive it, and spend the stored sunlight". Cooking changed from a single tap to a short skill-based step, and the early story choices now have lasting effects. The latest revision adds follow-up conversations for those choices, the stamp handbook with permanent upgrades as a long-term goal for the light mechanic, a result card after cooking, plot labels that state what the light did for that crop, a per-criterion breakdown of the festival judging, and a limit of three tokens per market-stall session. Earlier rounds in the same period added care methods per plot, crop seasons, chapters 4–5, a repeatable harvest festival with a 60-second market-stall mini-game, and neighbour friendship stories.

Test-only hooks are removed outside local development addresses (`file://`, `localhost`, `127.0.0.1`), including inside the native wrappers. The URL parameter `?swtest` remains; it only has an effect in automated browsers and does nothing for players.

This is a complete farming game with an independently playable loop, not a content pack for an action or transport-education title. Shared packaging is disclosed in `SHARED_ASSETS_AUDIT.md`: the Capacitor wrapper and our own `native-host.js` are shared with other apps on the same account; the audit was re-run on 11 November against this build for the 8 other titles whose source is still on the development machine and found no byte-identical game files and no identical long CSS rules; the other 6 titles could not be re-checked and only have the 15 October result (also no identical files). We do not claim that being a different genre alone resolves Guidelines 4.3 or 4.2.6.

Known gaps in this build: no dedicated basket-carrying animation; the drying rack uses a generic icon.

## Facts that must be supplied before submission

- The content provider, account owner, ownership/licensing evidence, and whether any client or partner commissioned the app must be confirmed by the owner. This repository does not establish those facts.
- Actual TestFlight/beta participation, dated feedback and the changes made in response. There is none on record today. Automated checks are not beta-user feedback.
- The iOS build 1.0.1 (8) still has to be built, signed and uploaded (the source bundle is ready; the Android build 8 is signed locally but not uploaded). Also outstanding: on-device iPhone/iPad video, Safari validation, the final privacy policy URL and the actual App Privacy / Play Data safety forms.
- The account owner said on 11 November that the app can go to review. Nothing has been uploaded, changed on the store page, or sent to Apple or Google yet; each of those steps waits for the owner to confirm the exact content.
