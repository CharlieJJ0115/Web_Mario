# Web Mario

A Cocos Creator 3.8.8 Web Mario game for the Software Studio Assignment 02, featuring Firebase membership, game progress storage, leaderboard, and Mario-style platform gameplay.

## Feature Overview

- Firebase email signup/login is integrated with Firestore player profiles and high score storage.
- The game flow includes start menu, level select, Level 1 gameplay, level clear, and game over scenes.
- Mario-style gameplay includes movement, jumping, collisions, damage, reborn behavior, question blocks, mushroom power-up, enemies, and turtle shell interactions.
- The HUD displays player life, score, timer, high score, and leaderboard rankings.
- The web build is configured for Firebase Hosting deployment.

## Project Completion Status

| Category | PPT Criteria | Score | Status | Implementation Notes |
| --- | --- | --- | --- | --- |
| Basic | Complete Game Process | 5% | Completed | The game includes start menu, login/signup flow, level select, playable stage, level clear, and game over flow. |
| Basic | Basic Rules | 50% | Completed | The world has physics and collisions, camera follow, at least one map, static walls, question blocks, controllable player movement/jump, player damage/life loss/reborn behavior, enemies, and mushroom block interaction. |
| Basic | Animations | 10% | Completed | Player walk/jump animations and enemy animations are implemented for Mario, Goomba, Turtle, and shell behavior. |
| Basic | Sound Effects | 10% | Completed | BGM, jump, death, stomp, grow/shrink, power-up, and other gameplay sound effects are integrated without stopping the BGM. |
| Basic | UI | 10% | Completed | The UI displays player life, score, timer, login/signup panels, level select, high score, and leaderboard. |
| Basic | Appearance | 10% | Completed | Mario-style sprites, backgrounds, bitmap fonts, HUD layout, menus, enemies, blocks, and effects are integrated for the final web game presentation. |
| Basic | Git version control | 5% | Completed | The project is managed with Git commits during development. |
| Bonus | Firebase | 5% | Completed | Firebase Hosting is configured, Firebase Authentication supports signup/login, and Firestore stores player profile and high score progress. |
| Bonus | Leaderboard | 5% | Completed | Firestore leaderboard data is queried and displayed as the top player rankings. |

## Detailed Item Notes

### Complete Game Process

The project provides a complete playable flow from the start menu to authentication, level selection, Level 1 gameplay, level clear, and game over. Players can return between scenes through the configured menu and redirect flow.

### Basic Rules(50%)

#### World map(10%)

#### Level design(5%)
Additional "floor" mechanism: can stand on platforms, can jump on it from the bottom(only upside collider). Works like demo video. 
<img src="README_image/floor.jfif" alt="Gameplay Screenshot" width="300">


#### player(15%)

#### enemies(15%)

1. Goomba 
2. Turtle: Can be turned into shell by stomping on its head, kick the shell to make the shell slide, sliding shell can kill Goomba and cause damage on player. 

#### question blocks(10%)

Supermushroom

### Animations

Mario has idle, walk, jump, fall, growth, shrink, and death-related visual states. Enemies also include movement animations, including Goomba walking, Goomba dead, Turtle walking, and turtle shell sliding behavior.

### Sound Effects

#### BGM(2%)
#### Jump and die sound effect(3%)
#### Additional sound effects

1. Stomp sound effect
2. Mushroom appear from question block
3. Powerup
4. Powerdown
5. Level clear
6. Gameover sound

### UI

The HUD shows level information, remaining lives, score, and timer during gameplay. The menu UI includes login/signup panels, level selection, high score display, logout support, and a leaderboard panel.

### Appearance

The visual presentation uses Mario-style sprites, tilemaps, backgrounds, bitmap fonts, UI graphics, enemies, items, blocks, and effects. The final web build presents the game with a consistent Mario-like style.

### Git Version Control

The project is maintained in a Git repository so development history and source changes can be tracked during the assignment.

### Firebase

 Firebase Authentication is used for email/password signup and login, while Firestore stores player profile data and high score progress.

### Leaderboard

The leaderboard reads player high scores from Firestore, orders them by score, and displays the top rankings in the level select UI.

In level select scene

<img src="README_image/levelSelectScene.jfif" alt="Gameplay Screenshot" width="300">

Click the leader board button to open leader panel

<img src="README_image/LeaderBoardButton.jfif" alt="Gameplay Screenshot" width="100">

<img src="README_image/LeaderBoardPanel.jfif" alt="Gameplay Screenshot" width="300">

