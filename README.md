# Textbox Calculator

A browser extension that turns any text input into a spreadsheet-like calculator. (Demo page does NOT require installing an extension!) Supports functions like SIN, IF, PI, STDEV, and more. Also provides a "variable" feature in the extension popup to store and use variables in calculations (and when changed, updates all calculations using that variable).

### Use cases
- quick calculations while filling out a form
- do a calculation in a group chat and send the result
- store frequently used values as variables (like currency exchange rates, etc.)
- update multiple calculations at once by changing a variable value in the popup (potentially useful while testing or debugging something, etc.)

### Installation
Download and unzip this: https://github.com/arjver/textbox-calculator/raw/refs/heads/main/dist.zip
Then in your browser go to chrome://extensions, click load unpacked, and select that folder.

### Build
- clone this repository
- npm install
- npm run build
- load the `dist` folder as an unpacked extension in your browser
