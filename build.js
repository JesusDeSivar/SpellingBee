/* Rebuilds the generated files from the sources:
     spelling-bee-trainer.html   index.html with words.js, words2.js and app.js inlined
     anki-spelling-bee-150.txt   the opening list as an Anki import
     anki-spelling-bee-170.txt   the tiebreaker list as an Anki import
   Run it after editing any source file:  node build.js                                */
"use strict";
const fs = require("fs");
const path = require("path");
const here = (f) => path.join(__dirname, f);

/* ---- one self-contained page ---- */
const html = fs.readFileSync(here("index.html"), "utf8");
const standalone = html.replace(/<script src="([^"]+)"><\/script>\n?/g, (m, src) =>
  "<script>\n" + fs.readFileSync(here(src), "utf8").replace(/\n$/, "") + "\n</script>\n"
);
fs.writeFileSync(here("spelling-bee-trainer.html"), standalone);

/* ---- the Anki decks: the same six fields plus tags the app exports ---- */
const load = (file, name) => {
  const src = fs.readFileSync(here(file), "utf8");
  return eval(src + "; " + name);          // the word files are plain data
};
const clean = (s) => String(s).replace(/[\t\r\n]+/g, " ").trim();

function anki(words, set) {
  const lines = words.map((w) => {
    const notes = "<b>" + clean(w.trap) + "</b><br><br>" +
      clean(w.ety) + "<br><br><i>" + clean(w.triv) + "</i>" +
      (w.esn ? "<br><br>" + clean(w.esn) : "");
    const tags = w.lvl.toLowerCase() + " " + w.org.toLowerCase().replace(/\s+/g, "-") +
      " " + set + " spelling-bee";
    return [clean(w.w), clean(w.ipa), clean(w.es), clean((w.pos ? w.pos + " " : "") + w.def),
            clean(w.ex).replace(new RegExp("\\b" + w.w + "\\b", "i"), "<b>" + w.w + "</b>"),
            notes, tags].join("\t");
  });
  return "#separator:tab\n#html:true\n#tags column:7\n" + lines.join("\n") + "\n";
}

const WORDS = load("words.js", "WORDS");
const WORDS2 = load("words2.js", "WORDS2");
fs.writeFileSync(here("anki-spelling-bee-150.txt"), anki(WORDS, "opening"));
fs.writeFileSync(here("anki-spelling-bee-170.txt"), anki(WORDS2, "tiebreak"));

console.log("spelling-bee-trainer.html  " + standalone.length + " bytes");
console.log("anki-spelling-bee-150.txt  " + WORDS.length + " notes");
console.log("anki-spelling-bee-170.txt  " + WORDS2.length + " notes");
