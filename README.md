# SpellingBee

Game for spelling bee practice for ESL student.

**▶ Play it: https://jesusdesivar.github.io/SpellingBee/**

---

## The Pronouncer's Desk

A spelling-bee trainer built around two study lists: the **opening 150** (50 Basic, 50
Intermediate, 50 Advanced) and a **170-word tiebreaker list** (60 B1, 60 B2, 50 Advanced
Challenge). It works the way the real contest does: **the word is spoken, never shown.**

On stage you are allowed to ask the pronouncer for the definition, for the word in a sentence,
and for its language of origin. Those four requests are the app's main controls. Asking costs
you nothing — spelling it with no help at all pays a bonus.

Every one of the 320 words carries a Spanish translation, its etymology, a piece of trivia, and
the specific spelling trap that catches people out.

### Choosing what you practise

A scope bar sits under the tabs and governs the whole app:

- **Lists** — the opening 150, the 170-word tiebreaker, or both.
- **Levels** — Basic, Intermediate, Advanced, in any combination.

The Bee, the Study List, the Flashcards, the Origins quiz and the Anki export all read the same
selection, so turning off Basic mid-session narrows every mode at once. At least one list and
one level always stay on, and the choice is remembered between visits.

23 words appear on both lists. They are kept on each, with that list's own level, IPA and
example sentence, but they share one progress record: spell *journey* in the tiebreaker and it
counts as spelled in the opening list too.

## What's in it

| Mode | What it does |
| --- | --- |
| **The Bee** | Hear the word, ask your questions, spell it. Practice rounds, Championship with three lives, and a drill built from the words you have missed. |
| **Study List** | Every word in play as a numbered placard — searchable, starrable, each opening a full card with audio. |
| **Flashcards** | Leitner boxes in three directions: English → Español, Español → English, definition → word. |
| **Origins** | Guess the language a word came from. Useful, since you may ask for exactly that mid-round. |
| **Anki Export** | The selected words as a tab-separated import file, tagged by level, list and origin language. |

### Speaking and listening

- **Audio** uses the browser's American English speech synthesis: normal speed, slow, the word
  in a sentence, and letter-by-letter.
- **Spell aloud** — say the letters into the microphone and the app writes them down.
  Speech recognition hears letter *names* ("see", "double you"), so transcripts run through a
  decoder before becoming a spelling. It fills the answer box; it never auto-submits, so a
  mishear can't cost you a word.
- **Your turn** — on any study card, say the word and find out whether it came through clearly.

### Built for Spanish speakers

111 words carry a `Para ti` note aimed at Spanish-interference errors — the doubled letters that
Spanish does not double (*comité* → **committee**, *recomendar* → **recommend**,
*oportunidad* → **opportunity**), and the false friends that cost real marks
(*librería* is a bookstore; *embarazada* does not mean embarrassed).

## Mascots

**Bea la abeja** is the pronouncer — she reads the words and reacts to how you do.
**Capi el carpincho** is the study buddy, on the grounds that the capybara is the calmest animal
alive and that is exactly what you want next to you at a spelling bee.

## Browser support

Speech **synthesis** works in all current browsers. Speech **recognition** (the microphone
features) needs Chrome, Edge or Safari — Firefox does not support it, and the mic buttons hide
themselves where the API is missing. Everything else works everywhere, and typing is always
available.

## Files

| File | |
| --- | --- |
| `index.html` | the page — markup and styles |
| `app.js` | game logic, speech, and the SVG mascots |
| `words.js` | the opening 150 with IPA, Spanish, etymology, trivia and traps |
| `words2.js` | the 170-word tiebreaker list, same fields plus its CEFR tier and part of speech |
| `build.js` | regenerates the three files below from the sources |
| `spelling-bee-trainer.html` | the whole app as one self-contained file, for offline use |
| `anki-spelling-bee-150.txt` | Anki import for the opening list: 6 fields plus tags, tab-separated |
| `anki-spelling-bee-170.txt` | the same for the tiebreaker list |

No dependencies. Open `index.html` on a local web server and it runs. (The microphone needs
`http://localhost` or HTTPS — browsers refuse speech recognition on `file://` pages.)

After editing `index.html`, `app.js`, `words.js` or `words2.js`, run `node build.js` to rebuild
the self-contained page and the two Anki files.

## Licence

MIT — see [LICENSE](LICENSE).
