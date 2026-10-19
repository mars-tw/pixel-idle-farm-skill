# App Review Notes — draft only

Status: PREPARED. These notes describe local web build `r81-20261015-1` / package `0.1.15`. The existing native-kit snapshot has NOT been rebuilt with this change. Do not attach these notes to an older binary.

No account, purchase, advertisement or remote service is required to play. All gameplay and the two narrative choices are available to ordinary players; there is no reviewer-only content.

## First three minutes

1. On a fresh launch, tap **做第一份陽光餐籃** (Make the first sunlight basket).
2. Follow the gold task card. Tap **種第一株小麥** to walk to a plot and sow wheat. About four seconds after planting, a sunlight patch appears on the fields.
3. When the task says **去光裡澆水**, tap it to walk into range and water the sunlit wheat. Growth advances immediately. The crop remembers this sunlight care even after the patch fades. If a patch lands on an empty field, **在光裡播種** also works.
4. Once ripe, tap **走近收成**. This uses the actual walking and frame-based harvest animation; inventory is awarded at the action frame.
5. Tap **裝好餐籃**. Choose **留在門邊** (Leave it at the doorstep) or **一起坐下** (Sit together). The character walks to Gary; two wheat are consumed when delivery settles. A different grandmother's note and Gary's reply appear for each choice.
6. Tap **返回農場** to continue the larger restoration story. Revisit the earned note through **日誌 → 陽光餐籃**. Reopening the app preserves the choice and does not allow a duplicate delivery.

The sunlight patch lasts about 16 seconds. Missing one does not lock progress; another appears later. The first basket has no daily reset or consecutive-login requirement. Existing daily tasks and the notes unlocked at three and seven stamps remain separate.

The three-minute route is tested using real input and real elapsed time in headless Chromium, without granting crops, skipping growth or injecting story progress. See the local evidence report for the measured duration. This is not a claim about real-user beta testing or iOS device performance.

## Material changes and limits

This revision connects the transient sunlight mechanic to a first-session recipe, actual inventory consumption, a choice of delivery, a permanent narrative outcome and a changed NPC reply. Series cross-promotion links and generator-style product slogans have been removed from the game UI. The game's farm world, crop/character atlas and music remain the existing farm assets; dedicated basket-carrying and note illustrations are still missing.

This is a complete farming game with an independently playable farming/restoration loop, rather than a content pack for an action or transport-education title. Shared standard Capacitor packaging is disclosed in `SHARED_ASSETS_AUDIT.md`. We do not claim that having different genres alone resolves Guidelines 4.3 or 4.2.6.

## Facts that must be supplied before submission

- The content provider, account owner, ownership/licensing evidence, and whether any client/partner commissioned the app must be confirmed by the owner. This repository does not establish those facts.
- Actual TestFlight/beta participation, dated feedback and the changes made in response. Automated checks are not beta-user feedback.
- A new native build containing this revision, on-device iPhone/iPad video, Safari validation, the final privacy policy URL and the actual App Privacy / Play Data safety forms.
- Final decision on whether this app should be submitted, combined or retained as a web/Google Play product. No resubmission or store message was sent in this round.
