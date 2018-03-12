var unjustifiable;

unjustifiable = function(options) {
  var boxSpan, despanifyElement, findBreaks, findBreaksI, glueRegex, glueSpan, hasClass, lineLengths, listWordlets, measureWordlets, penaltySpan, punctuationSpan, reifyBreakChain, spanifyElement, spanifyText, spanifyWord, walkElt;
  options = options || {};
  _.defaults(options, {
    hyphenator: function(w) {
      return [w];
    },
    stretch: 15,
    shrink: -1,
    overhang: 20,
    hyphenPenalty: 1000
  });

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
  glueSpan = function(glue) {
    return "<span class='glue'>" + glue + "</span>";
  };

  boxSpan = function(wordlet) {
    return "<span class='box'>" + wordlet + "</span>";
  };

  punctuationSpan = function(wordlet) {
    return "<span class='punctuation'>" + wordlet + "</span>";
  };

  penaltySpan = function() {
    return "<span class='penalty'></span>";
  };

  spanifyWord = function(word) {
    var parts, spanifiedWord, syllables;
    syllables = options.hyphenator(word);
    spanifiedWord = boxSpan(syllables[0]);
    parts = _.map(syllables, boxSpan);
    return parts.join(penaltySpan());
  };

  glueRegex = /(&nbsp;|(?:&mdash;|&rdquo;|[-,;:"”=\.\/\)\]\}\?])+(?:&nbsp;)*)/;
  
  spanifyText = function(text) {
    var spannedWords, words;
    text = text.replace(/\n ?/g, " ").replace(/ +/g, "&nbsp;");
    words = text.split(glueRegex);
    spannedWords = _.map(words, function(word, i) {
      if (word.match(glueRegex)) {
        return glueSpan(word) + " ";
      } else if (word) {
        return spanifyWord(word);
      } else {
        return "";
      }
    });
    return spannedWords.join("");
  };

  spanifyElement = function(elt) {
    var newHtml, parts;
    parts = elt.childNodes;
    newHtml = "";
    _.each(parts, function(part) {
      if (part.nodeType === 3) {
        return newHtml += spanifyText(part.textContent);
      } else {
        spanifyElement(part);
        return newHtml += part.outerHTML;
      }
    });
    return elt.innerHTML = newHtml;
  };

  /*
  Walking the DOM in this particular way happens several times,
  so I've pulled it out into a utility function. If a node has children
  (not a text node, or an image, or anything),
   */
  hasClass = function(elt, cls) {
    if (elt.hasAttribute("class")) {
      return elt.getAttribute("class").indexOf(cls) > -1;
    }
  };

  walkElt = function(elt, action) {
    return _.each(elt.children, function(bit) {
      var rec;
      if (hasClass(bit, "unjustifiable-ignore")) {

      } else if (bit.children.length) {
        return rec = walkElt(bit, action);
      } else {
        return action(bit);
      }
    });
  };

  /*
  listWordlets takes a DOM element that has already been spanified,
  and makes an array of dictionaries that summarizes the important
  data about the word-fragments therein. It's recursive to cope with
  nested elements (<strong>, <em>, etc.)
   */
  listWordlets = function(elt) {
    var list;
    list = [];
    walkElt(elt, function(bit) {
      var wordlet;
      wordlet = {
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
  lineLengths = function(elt) {
    var lineStart, list, prevHeight, prevOffset;
    list = [];
    prevHeight = 0;
    lineStart = 0;
    prevOffset = null;
    walkElt(elt, function(bit) {
      var offset;
      offset = bit.getClientRects()[0];
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

  /*
  A possible line break is scored in part based on the width of the
  line it makes. We can measure that width (and the amount of
  stretching and shrinking we can do to the line) by summing the
  respective parts of all the wordlets that make up the line.
   */
  measureWordlets = function(wordlets, start, end) {
    var slice, width;
    slice = wordlets.slice(start, end);
    while (slice.length && slice[0].type === "glue") {
      slice = slice.slice(1);
    }
    width = _.sum(_.pluck(slice, "width"));
    while (slice.length && slice[slice.length - 1].type === "glue") {
      slice.pop();
    }
    return {
      width: width,
      stretch: _.sum(_.pluck(slice, "stretch")),
      shrink: _.sum(_.pluck(slice, "shrink")),
      glues: _.filter(slice, function(w) {
        return w.type === "glue";
      }).length
    };
  };

  /*
  Given an index of a wordlet, and a set of possible line breaks
  made previous to that wordlet, findBreaksI determines all the
  ways we might make a line break at the specified wordlet. It also
  determines which of the line breaks in the list of possible line
  breaks are still relevant to choosing future breaks.
   */
  findBreaksI = function(wordlets, index, breaks, lineLengths) {
    var newBreak, oldBreaks;
    oldBreaks = [];
    newBreak = null;
    _.each(breaks, function(previousBreak) {
      var compression, cost, lineLength, measure;
      lineLength = lineLengths[previousBreak.lineNumber];
      measure = measureWordlets(wordlets, previousBreak.index, index);
      compression = lineLength - measure.width;
      if (index === wordlets.length - 1) {
        compression = Math.min(compression, 0);
      }
      if (compression >= measure.shrink && compression <= measure.stretch) {
        cost = previousBreak.cost;
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
        return oldBreaks.push(previousBreak);
      }
    });
    if (newBreak) {
      oldBreaks.push(newBreak);
    }
    return oldBreaks;
  };

  /*
  Loops through each wordlet in a paragraph, and uses findBreaksI to
  discover any possible line breaks at that point; once it reaches the
  end, it chooses the lowest-cost set of breaks, which it returns.
   */
  findBreaks = function(wordlets, lineLengths) {
    var breaks, ret;
    breaks = [
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
    _.each(wordlets, function(wordlet, index) {
      if (wordlet.type === "penalty" || wordlet.type === "glue") {
        return breaks = findBreaksI(wordlets, index, breaks, lineLengths);
      }
    });
    ret = _.min(breaks.reverse(), function(breakChain) {
      return breakChain.cost;
    });
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
  reifyBreakChain = function(chain) {
    var compression, rets, spacing;
    rets = [
      {
        gluesSoFar: 0,
        spacing: 0,
        firstCount: 100
      }
    ];
    while (chain.previous) {
      compression = chain.compression;
      spacing = compression / chain.glues;
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
  despanifyElement = function(elt, linebreaks) {
    var cbreak, closeSpan, openSpan, recur;
    cbreak = linebreaks[linebreaks.length - 1];
    openSpan = function(cbreak, text) {
      return text.push("<span style=\"word-spacing: " + cbreak.spacing + "px\">");
    };
    closeSpan = function(text) {
      return text.push("</span>");
    };
    recur = function(elt) {
      var text;
      text = [];
      openSpan(cbreak, text);
      _.each(elt.children, function(bit) {
        var bittext;
        if (bit.children.length) {
          closeSpan(text);
          recur(bit);
          text.push(bit.outerHTML);
          return openSpan(cbreak, text);
        } else {
          bittext = bit.innerHTML;
          if (cbreak && bit === cbreak.breakElement) {
            if (bit.getAttribute("class") === "penalty") {
              text.push("-");
            }
            text.push(bittext);
            linebreaks.pop();
            closeSpan(text);
            text.push("<br />");
            cbreak = linebreaks[linebreaks.length - 1];
            return openSpan(cbreak, text);
          } else if (bit.getAttribute("class") === "box") {
            return text.push(bittext);
          } else if (bit.getAttribute("class") === "glue") {
            return text.push(bittext.replace("&nbsp;", " "));
          }
        }
      });
      closeSpan(text);
      return elt.innerHTML = text.join("");
    };
    return recur(elt);
  };
  return function(elt) {
    var bestBreaks, lineLength, wordlets;
    spanifyElement(elt);
    elt.style.textAlign = "justify";
    lineLength = lineLengths(elt);
    lineLength.push(lineLength[lineLength.length - 1]);
    elt.style.textAlign = "left";
    wordlets = listWordlets(elt);
    bestBreaks = findBreaks(wordlets, lineLength);
    return despanifyElement(elt, bestBreaks);
  };
};

window.unjustifiable = unjustifiable;
