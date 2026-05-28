# Web Mario

A Cocos Creator 3.8.8 Web Mario project for the Software Studio assignment. The game includes a start menu, membership flow, level select, Level 1 gameplay, Firebase/Firestore integration, high score tracking, leaderboard, and Mario-style enemy/object mechanics.

## Project Completion Status

| Category | PPT Criteria | Score | Status | Implementation Notes |
| --- | --- | --- | --- | --- |
| Basic | Cocos Creator web game setup | TBD | Completed | The project is implemented with Cocos Creator 3.8.8 and TypeScript. |
| Basic | Firebase Hosting | TBD | Completed | `firebase.json` is configured to deploy the web build from `build/web-desktop-005`. |
| Basic | Git version control | TBD | Completed | The project is managed in a Git repository. |
| Basic | Start menu / scene flow | TBD | Completed | Start menu supports login/signup entry points and scene transition into level select. |
| Basic | Level select | TBD | Completed | Level select shows player information, high score, logout, leaderboard, and level buttons. |
| Basic | Level 1 playable stage | TBD | Completed | `Level_1` contains a playable stage with player, enemies, blocks, HUD, and level clear flow. |
| Basic | Player movement / jump / camera follow | TBD | Completed | Player movement, jump, stomp bounce, damage, death flow, and camera follow are implemented. |
| Basic | HUD score / timer / life | TBD | Completed | HUD scripts display level, score, timer, and remaining lives using bitmap-style labels. |
| Basic | Game over / level clear flow | TBD | Completed | Game over and level clear scenes/flows are implemented, including timer bonus scoring. |
| Membership / Database | Email signup / login | TBD | Completed | Firebase Authentication REST API is used for email/password signup and login. |
| Membership / Database | Logout | TBD | Completed | Logout clears the local auth session and returns the player to the start menu. |
| Membership / Database | Firestore user profile | TBD | Completed | Firestore stores `users/{uid}` with username, email, highScore, and updatedAt. |
| Membership / Database | Personal high score | TBD | Completed | Level clear updates the player's Firestore highScore only when the new score is higher. |
| Membership / Database | Leaderboard top 3 | TBD | Completed | Leaderboard queries Firestore users ordered by highScore descending and displays the top 3. |
| Gameplay Features | Tilemap collision / one-way platform | TBD | Completed | Tilemap loader creates static wall colliders and one-way platform colliders from map data. |
| Gameplay Features | Question block | TBD | Completed | Question blocks support hit detection and item spawning behavior. |
| Gameplay Features | Mushroom / power-up | TBD | Completed | Mushroom power-up uses dynamic physics, movement, collection, score reward, and player growth. |
| Gameplay Features | Goomba enemy | TBD | Completed | Goomba supports waypoint movement, stomp defeat, player damage, and shell defeat. |
| Gameplay Features | Turtle enemy | TBD | Completed | Turtle supports waypoint movement, two-frame walking animation, stomp conversion into shell, and shell defeat. |
| Gameplay Features | Turtle shell sliding attack | TBD | Completed | Turtle shell supports idle/sliding states, 4-frame sliding animation, wall bounce, enemy defeat, and player damage only while sliding. |
| Gameplay Features | Enemy score reward | TBD | Completed | Stomping enemies and defeating enemies with shells add score through the active score HUD. |
| Advanced / Polish | BGM / SFX | TBD | Completed | BGM and sound effects are integrated for scenes and gameplay interactions. |
| Advanced / Polish | Bitmap HUD fonts | TBD | Completed | White/yellow bitmap fonts are used for Mario-style HUD and menu labels. |
| Advanced / Polish | Responsive/web deployment readiness | TBD | Completed | The project has been built for web desktop and deployed through Firebase Hosting. |
| Advanced / Polish | Level 2 | TBD | Not completed / Disabled | Level 2 is present in the level select UI but disabled because the stage is not completed. |

## Notes

- Score values are marked `TBD` until the exact PPT grading percentages are confirmed.
- Some UI wiring is configured manually in Cocos Creator scenes through Inspector bindings.
- Firebase Console setup, Firestore rules, build, deploy, and final gameplay testing are handled manually.
