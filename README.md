# Overclock

A small deck-builder about the RAM shortage in the age of AI.

Every AI lab wants memory, and they all want it now. You run the factory that makes it. Sand goes in one end of a conveyor belt, machines along the way turn it into silicon, then a wafer, then a chip, then a RAM stick, and whatever reaches Shipping counts toward the order.

Play it here: https://www.raysums.com/overclock/

It runs in the browser on a phone or a computer. No account, no install.

## How to play

- Each shift has 3 runs. Before each run you draw 5 machine cards.
- Place any of them on the belt. Placed machines stay until the shift ends.
- Press Run and 5 scoops of sand roll down the belt. Each machine only works on its own type of item, so the order of the line is the plan.
- Fill the order by the end of the 3rd run or the job is over.
- The belt folds back on itself. Tiles with hazard stripes between them are bends, and machines on a bend work items twice.
- Between shifts, add a machine to your deck or scrap one.
- Every third shift is a boss shift with one twist rule. Beat it to earn a rare machine.

The first job starts on a straight belt to teach the basics. Tap the ? in the game for the full rules.

## Run it locally

It is plain HTML, CSS and JavaScript with no build step and no dependencies.

```
git clone https://github.com/raymondsums/overclock.git
cd overclock
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser. Any static file server works.

## What is in here

- `index.html` the page, styles and layout
- `engine.js` the rules: cards, belt layouts, quotas, boss shifts and how a run is scored
- `game.js` the board, the cards and all the drawing
- `intro.js` the opening and the rules sheet
- `sound.js` the sound effects

All the art is drawn in code as SVG and every sound is made live with the Web Audio API, so there are no image or audio files. Progress is saved in your browser's local storage and nothing is sent anywhere.

## A note on the names

The orders come from real AI companies, used by name only as part of the joke. The game is not made by or connected to any of them.

Made by Raymond Su.
