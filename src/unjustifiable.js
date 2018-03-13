var unjustifiable;

unjustifiable = function(options) {
  options = {
    hyphenator: function(w) {
      return [w];
    },
    stretch: 15,
    shrink: -1,
    overhang: 20,
    hyphenPenalty: 1000,
    ...(options || {})
  };

  /*
  Spanify-ing is the process of wrapping each syllable in a
  boxSpan, each space in a glueSpan, and each soft-break in a
  penaltySpan.
  
  In order to get accurate measurements of each syllable's width,
  even in places where they are bold, or italic, or a different font
  or whatever, wrap each syllable in a <span> temporarily. Since I'm
  doing that *anyway*, I decided it wasn't too disgusting to stick
  glue and penalties in the DOM as well. They're only inserted
  temporarily, during the measurement process, and it makes the
  eventual rendering process simpler.
   */

  const spanMaker = function(klass) {
    return content => {
      const elt = document.createElement("span");
      elt.className = klass;
      if (content) elt.innerHTML = content;
      return elt;
    }
  }

  const glueSpan = spanMaker("glue");
  const boxSpan = spanMaker("box");
  const punctuationSpan = spanMaker("punctuation");
  const penaltySpan = spanMaker("penalty");

  const spanifyWord = function(word) {
    const syllables = options.hyphenator(word);
    const spanifiedWord = boxSpan(syllables[0]);
    const parts = [];
    syllables.forEach((s, i) => {
      if (i > 0) parts.push(penaltySpan());
      parts.push(boxSpan(s));
    });
    return parts;
  };

  const glueRegex = /(&nbsp;|(?:&mdash;|&rdquo;|[-,;:"”=\.\/\)\]\}\?])+(?:&nbsp;)*)/;
  
  const spanifyText = function(text) {
    text = text.replace(/\n ?/g, " ").replace(/ +/g, "&nbsp;");
    const words = text.split(glueRegex);
    const spannedWords = words.map(function(word, i) {
      if (word.match(glueRegex)) {
        return [glueSpan(word), " "];
      } else if (word) {
        return spanifyWord(word);
      } else {
        return "";
      }
    })
    return [].concat.apply([], spannedWords);
  };

  const spanifyElement = function(elt) {
    const parts = elt.childNodes;
    var contents = [];
    parts.forEach(function(part) {
      if (part.nodeType === 3) {
        contents = contents.concat(spanifyText(part.textContent));
      } else {
        contents.push(spanifyElement(part));
      }
    });

    var clonedElt = elt.cloneNode(false);
    clonedElt.innerHTML = "";
    clonedElt.append.apply(clonedElt, contents);
    elt.parentNode.replaceChild(clonedElt, elt);
    return clonedElt;
  };

  /*
  Walking the DOM in this particular way happens several times,
  so I've pulled it out into a utility function. If a node has children
  (not a text node, or an image, or anything),
   */
  const hasClass = function(elt, cls) {
    if (elt.hasAttribute("class")) {
      return elt.getAttribute("class").indexOf(cls) > -1;
    }
  };

  const walkElt = function(elt, action) {
    return Array.from(elt.children).forEach(function(bit) {
      if (hasClass(bit, "unjustifiable-ignore")) {
        // Do nothing
      } else if (bit.children.length) {
        walkElt(bit, action);
      } else {
        action(bit);
      }
    });
  };

  /*
  listWordlets takes a DOM element that has already been spanified,
  and makes an array of dictionaries that summarizes the important
  data about the word-fragments therein. It's recursive to cope with
  nested elements (<strong>, <em>, etc.)
  */
  const listWordlets = function(elt) {
    const list = [];
    walkElt(elt, function(bit) {
      const wordlet = {
        type: bit.getAttribute("class"),
        span: bit,
        width: bit.getClientRects()[0].width
      };
      if (wordlet.type === "glue" && bit.innerHTML.match("&nbsp;")) {
        wordlet.stretch = options.stretch;
        wordlet.shrink = options.shrink;
      } else if (wordlet.type === "penalty") {
        wordlet.cost = options.hyphenPenalty;
        wordlet.width = 0;
      }
      return list.push(wordlet);
    });
    return list;
  };

  /*
  lineLengths takes an element that has been spanified and produces
  a list of line-lengths. Expects the text-block to be
  css-justified.
   */
  const lineLengths = function(elt) {
    const list = [];
    var prevHeight = 0;
    var lineStart = 0;
    var prevOffset = null;
    walkElt(elt, bit => {
      const offset = bit.getClientRects()[0];
      if (prevOffset && offset.top - prevOffset.top > 2) {
        list.push(prevOffset.right - lineStart - options.overhang);
        lineStart = offset.left;
      }
      if (!prevOffset) {
        lineStart = offset.left;
      }
      return prevOffset = offset;
    });
    return list;
  };

  const sumPluck = function(list, name) {
    return list.map(e => e[name] || 0).reduce((a, b) => a + b, 0);
  }

  /*
  A possible line break is scored in part based on the width of the
  line it makes. We can measure that width (and the amount of
  stretching and shrinking we can do to the line) by summing the
  respective parts of all the wordlets that make up the line.
   */
  const measureWordlets = function(wordlets, start, end) {
    var slice = wordlets.slice(start, end);
    while (slice.length && slice[0].type === "glue") {
      slice = slice.slice(1);
    }
    var width = sumPluck(slice, "width");
    while (slice.length && slice[slice.length - 1].type === "glue") {
      slice.pop();
    }
    return {
      width: width,
      stretch: sumPluck(slice, "stretch"),
      shrink: sumPluck(slice, "shrink"),
      glues: slice.filter(w => w.type === "glue").length
    };
  };

  /*
  Given an index of a wordlet, and a set of possible line breaks
  made previous to that wordlet, findBreaksI determines all the
  ways we might make a line break at the specified wordlet. It also
  determines which of the line breaks in the list of possible line
  breaks are still relevant to choosing future breaks.
   */
  const findBreaksI = function(wordlets, index, breaks, lineLengths) {
    var oldBreaks = [];
    var newBreak = null;
    breaks.forEach(previousBreak => {
      const lineLength = lineLengths[previousBreak.lineNumber];
      const measure = measureWordlets(wordlets, previousBreak.index, index);
      var compression = lineLength - measure.width;
      if (index === wordlets.length - 1) {
        compression = Math.min(compression, 0);
      }
      if (compression >= measure.shrink && compression <= measure.stretch) {
        let cost = previousBreak.cost;
        cost += Math.pow(compression, 2);
        if (wordlets[index].type === "penalty") {
          cost += wordlets[index].cost;
        }
        cost += Math.pow(previousBreak.compression - compression, 2);
        if (!newBreak || cost <= newBreak.cost) {
          newBreak = {
            wordlet: wordlets[index],
            cost: cost,
            compression: compression,
            width: measure.width,
            glues: measure.glues,
            index: index,
            previous: previousBreak,
            lineNumber: previousBreak.lineNumber + 1
          };
        }
      }
      if ((measure.width + measure.shrink) < lineLength && index < wordlets.length - 1) {
        oldBreaks.push(previousBreak);
      }
    });
    if (newBreak) {
      oldBreaks.push(newBreak);
    }
    return oldBreaks;
  };

  const getMin = function(list, iteratee) {
    var result = null, lastComputed = Infinity, value, computed;
    list.forEach(function(value) {
      computed = iteratee(value);
      if (computed < lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  }

  /*
  Loops through each wordlet in a paragraph, and uses findBreaksI to
  discover any possible line breaks at that point; once it reaches the
  end, it chooses the lowest-cost set of breaks, which it returns.
   */
  const findBreaks = function(wordlets, lineLengths) {
    var breaks = [
      {
        wordlet: {},
        cost: 0,
        compression: 0,
        index: 0,
        previous: null,
        lineNumber: 0
      }
    ];
    wordlets.push({
      type: "glue",
      width: 0
    });
    wordlets.forEach(function(wordlet, index) {
      if (wordlet.type === "penalty" || wordlet.type === "glue") {
        breaks = findBreaksI(wordlets, index, breaks, lineLengths);
      }
    });
    var ret = getMin(breaks.reverse(), function(breakChain) {
      return breakChain.cost;
    });
    if (!ret) return;
    return reifyBreakChain(ret);
  };

  /*
  The linked list that findBreaks produces is kinda difficult to work
  with; this function munges it into a cleaner array, with useful
  information about spacing.
  
  Each element in the resulting list has the following info:
  
  - breakElement: the wordlet on which to break the line.
  - firstSpacing: the word-spacing for the first n words
  - restSpacing: the wordSpacing for the remaining words
  - firstCount: the number n
  - gluesSoFar: 0. Used by despanify.
  - currentSpacing: Used by despanify.
   */
  const reifyBreakChain = function(chain) {
    const rets = [
      {
        gluesSoFar: 0,
        spacing: 0,
        firstCount: 100
      }
    ];
    while (chain.previous) {
      const compression = chain.compression;
      const spacing = compression / chain.glues;
      rets.push({
        breakElement: chain.wordlet.span,
        spacing: spacing
      });
      chain = chain.previous;
    }
    return rets;
  };

  /*
  This is the only chunk of code here I'm ashamed of. It turns all those
  horrible spans back into a more sane arrangement of two spans per line
  (two because we have to simulate sub-pixel word-spacing, so one span
  might be 1px spacing and the other 2, to make an average
  one-point-something.
  
  It is horrible because of a particular edge-case: where the line break
  occurs in the middle of, for instance, a <strong> tag. In that
  particular case, there must be more than two spans, to take care of
  both the text inside the strong tag (which will have two or more
  different spacings) and the text oustide it.
  
  So apologies aside, this is messy but necessary.
   */
  const despanifyElement = function(elt, linebreaks) {
    if (!linebreaks) return despanifyNoJustify(elt);

    var curElt = null;
    const openSpan = (cbreak) => {
      const elt = document.createElement("span");
      elt.style.wordSpacing = cbreak.spacing + "px";
      curElt = elt;
    }
    const closeSpan = elts => elts.push(curElt);
    const pushContent = content => curElt.innerHTML += content;

    const newLine = (elts) => {
      const elt = document.createElement("br");
      elt.setAttribute("aria-hidden", "true");
      elt.style.userSelect = "none";
      elts.push(elt);
    }
    const hyphen = (elts) => {
      const elt = document.createElement("span");
      elt.innerText = "-"
      elt.style.userSelect = "none";
      elts.push(elt);
    }

    var cbreak = linebreaks[linebreaks.length - 1];

    const recur = function(elt) {
      var elts = [];
      openSpan(cbreak);
      Array.from(elt.children).forEach(function(bit) {
        if (bit.children.length) {
          closeSpan(elts);
          elts.push(recur(bit));
          openSpan(cbreak);
        } else {
          let bittext = bit.innerHTML;
          if (cbreak && bit === cbreak.breakElement) {
            if (bit.getAttribute("class") === "penalty") {
              closeSpan(elts);
              hyphen(elts);
            } else {
              pushContent(bittext);
              closeSpan(elts);
            } 
            newLine(elts);
            linebreaks.pop();
            cbreak = linebreaks[linebreaks.length - 1];
            openSpan(cbreak);
          } else if (bit.getAttribute("class") === "box") {
            pushContent(bittext);
          } else if (bit.getAttribute("class") === "glue") {
            pushContent(bittext.replace("&nbsp;", " "));
          } else {
            elts.push(bit);
          }
        } 
      });
      closeSpan(elts);

      // Now return a new elt with the new contents:
      var clonedElt = elt.cloneNode(false);
      clonedElt.innerHTML = "";
      clonedElt.append.apply(clonedElt, elts);
      return clonedElt;
    };

    elt.parentNode.replaceChild(recur(elt), elt);
  };

  const despanifyNoJustify = function(elt) {
    const recur = function(elt) {
      var elts = [];
      Array.from(elt.children).forEach(function(bit) {
        var bittext;
        if (bit.children.length) {
          elts.push(recur(bit));
        } else {
          if (["penalty", "box", "glue"].indexOf(bit.getAttribute("class")) >= 0) {
            bittext = bit.innerHTML.replace("&nbsp;", " ");
            elts.push(bittext);
          } else {
            elts.push(bit);
          }
        }
      });
      // SO COSTLY. DO WITH CREATE ELEMENT.
      var clonedElt = elt.cloneNode(false);
      clonedElt.innerHTML = "";
      clonedElt.append.apply(clonedElt, elts);
      return clonedElt;
    }

    elt.parentNode.replaceChild(recur(elt), elt);
  };

  return function(elt) {
    var bestBreaks, lineLength, wordlets;

    // Wrap each syllable in a span so we can measure it
    elt = spanifyElement(elt);

    // Temporarily justify so we can measure line lengths (esp. around floats)
    elt.style.textAlign = "justify";
    lineLength = lineLengths(elt);
    // Last line assume matches next-to-last-line
    lineLength.push(lineLength[lineLength.length - 1]);
    elt.style.textAlign = "left";

    // Find the proper places to break each line
    wordlets = listWordlets(elt);
    bestBreaks = findBreaks(wordlets, lineLength);

    // Render the new line breaks
    despanifyElement(elt, bestBreaks);
  };
};

window.unjustifiable = unjustifiable;
