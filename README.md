# happymonkey1@'s Quizlet Userscript(s)

Tampermonkey userscript(s) for Quizlet.

Userscripts:
- `quizlet-csv-import.user.js`
  - A Tampermonkey userscript that adds CSV import support to Quizlet flashcard sets.

# Quizlet CSV Import

## Install
1. Install the Tampermonkey browser extension.
    - [Chrome webstore](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en)
2. Open the Quizlet CSV import userscript [install link](https://github.com/happymonkey1/quizlet-userscripts/raw/refs/heads/mainline/quizlet-csv-import.user.js)
3. Tampermonkey will open an install page.
4. Click Install.
5. Open Quizlet and go to [Create a new flashcard set page](https://quizlet.com/create-set).

You _should_ see an Import CSV button next to Quizlet's normal Import button.

### Chrome Setup

Chrome requires explicit permission for Tampermonkey to run userscripts.

1. Open `chrome://extensions`.
2. Select Tampermonkey.
3. Enable Allow User Scripts.
4. Make sure Tampermonkey has permission to run on quizlet.com.

Reload Quizlet after changing these settings.

## User Guide

### Import a CSV

The CSV should contain two columns:

```csv
Front,Back
Question 1,Answer 1
Question 2,Answer 2
```

The script also recognizes headers such as:

- `Term` / `Definition`
- `Question` / `Answer`
- `Front` / `Back`

To import:

1. Open Create a new flashcard set in Quizlet.
2. Click Import CSV.
3. Select the CSV file.
4. Review the cards in Quizlet's import preview.
5. Click Quizlet's Import button.
6. Create the flashcard set normally.

### Script Updates

The script updates automatically.

If needed, go to Tampermonkey extension and use `Check for userscript updates`.

# Bug / Feature Request / Issues

Submit a GitHub issue.

Include userscript in question and context about problem/feature/issue.

# Disclaimer

```
THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```