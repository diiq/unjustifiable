var Unjustifiable = function(options){
    // Defaults.
    // If no hyphenator is provided, don't hyphenate.
    options.hyphenator = options.hyphenator || function(w) {
        return [w];
    };
    // All measurements in px.
    options.space = options.space || 4;
    options.stretch = options.stretch || 5;
    options.shrink = options.shrink || -1;
    options.hyphen_width = options.hyphen_width || 0;
    options.overhang = options.overhang == undefined ? 6 : options.overhang;;
    // This is a cost, which is measured in mostly-meaningless units: px^2
    options.hyphen_penalty = options.hyphen_penalty || 700;

    /**
     * PART I: PARSING, HYPHENATING, AND MEASURING THE TEXT
     */

    /**
     * Spanify-ing is the process of wrapping each syllable in a box_span, each
     * space in a glue_span, and each soft-break in a penalty_span.
     *
     * In order to get accurate measurements of each syllable's width, even in
     * places where they are bold, or italic, or a different font or whatever,
     * wrap each syllable in a <span> temporarily. Since I'm doing that *anyway*,
     * I decided it wasn't too disgusting to stick glue and penalties in the DOM
     * as well. They're only inserted temporarily, during the measurement
     * process, and it makes the eventual rendering process simpler.
     */
    var glue_span = function(glue) {
        return "<span class='glue'>" + glue + "</span>";
    };

    var box_span = function(wordlet) {
        return "<span class='box'>" + wordlet + "</span>";
    };

    var punctuation_span = function(wordlet) {
        return "<span class='punctuation'>" + wordlet + "</span>";
    };

    var penalty_span = function() {
        return "<span class='penalty'></span>";
    };

    var spanify_word = function(word) {
        // Ideally, word-joining punctuation will overhang the text, making a more
        // orderly margin. Here, we split out any such punctuation.
        var syllables = options.hyphenator(word);
        var spanified_word = box_span(syllables[0]);
        for (var i = 1; i < syllables.length; i++) {
            spanified_word += penalty_span();
            spanified_word += box_span(syllables[i]);
        }
        return spanified_word;
    };
    var glue_regex = /(&nbsp;|&mdash;|[\—\-]|[\—\-\.\,\/\;\:\)\]\}\?](?:&nbsp;)?)/;
    var spanify_text = function(text) {
        text = text.replace(/ /g, "&nbsp;");
        var words = text.split(glue_regex);
        var spanned_words = _.map(words, function(word, i) {
            if (word.match(glue_regex)) {
                return glue_span(word) + " ";
            } else if (word) {
                return spanify_word(word);
            } else {
                return "";
            }
        });
        return spanned_words.join("");
    };

    var spanify_element = function(elt) {
        // Making a note: I get empty spans surrounding nested elements. This
        // doesn't affect the outcome, but it's strange and should be fixed if
        // it requires no contortions.
        elt = $(elt);
        var parts = elt.contents();
        var new_html = "";
        _.map(parts, function (part) {
            if (part.nodeType === 3) {
                // It's a text node.
                new_html += spanify_text(part.textContent);
            } else {
                // It's a nested DOM elt; recurse.
                spanify_element(part);
                new_html += part.outerHTML;
            }
        });
        elt.html(new_html);
    };

    /** Walking the DOM in this particular way happens several times,
     * so I've pulled it out into a utility function.
     */
    var walk_elt = function(elt, during, before, after, before_rec, after_rec) {
        if (before) before(bit);
        _.each(elt.children, function(bit) {
            if (bit.children.length) {
                if (before_rec) before_rec(bit);
                var rec = walk_elt(bit, during, before, after, before_rec, after_rec);
                if (after_rec) after_rec(bit, rec);
            } else {
                if (during) during(bit);
            }
        });
        if (after) return after(bit);
    };

    /**
     * list_wordlets takes a DOM element that has already been spanified, and makes
     * an array of dictionaries that summarizes the important data about the
     * word-fragments therein.
     * It's recursive to cope with nested elements (<strong>, <em>, etc.)
     */

    var list_wordlets = function(elt, divisor) {
        var list = [];
        walk_elt(elt, function(bit) {
            var wordlet = {type: $(bit).attr("class"),
                       span: bit,
                       width: bit.offsetWidth / divisor};
            if (wordlet.type === "glue" && $(bit).html().match("&nbsp;")) {
                wordlet.stretch = options.stretch;
                wordlet.shrink = options.shrink;
            } else if (wordlet.type === "penalty") {
                wordlet.cost = options.hyphen_penalty;
                wordlet.width = 0;
            }
            list.push(wordlet);
        });
        return list;
    };

    /**
     * line_lengths takes an element that has been spanified and produces a list
     * of line-lengths. Expects the text-block to be css-justified.
     */
    var line_lengths = function(elt) {
        var list = [];
        var prev_height = 0;
        var line_start = 0;
        var prev_bit = null;
        walk_elt(elt, function(bit) {
            if (bit.offsetTop > prev_height) {
                if (prev_bit)
                    list.push(prev_bit.offsetLeft +
                              prev_bit.offsetWidth -
                              line_start -
                              options.overhang);
                    line_start = bit.offsetLeft;
            }
            prev_height = bit.offsetTop;
            prev_bit = bit;
        });
        return list;
    };


    /**
     * n_times_bigger is a really silly function. Here's the deal:
     * browsers that zoom -- all browsers, but particularly mobile
     * browsers, do this stupid thing where they report whole-number
     * dimensions, but *use* fractional pixel dimensions. This really
     * messes up the game of measuring word sizes (things can be off
     * by 5-10 pixels by the end of a line.
     *
     * So what we do is we measure *ten times* the string, and divide
     * by ten. Poor man's floating point.
     */

    var n_times_bigger = function(elt, times) {
        walk_elt(elt, function(bit) {
            bit.innerHTML = _.times(times, function(){return bit.innerHTML;}).join("");
        });
    };

    /**
     * PART II: FINDING IDEAL LINEBREAK POSITIONS
     */

    /**
     * A possible line break is scored in part based on the width of the line it
     * makes. We can measure that width (and the amount of stretching and
     * shrinking we can do to the line) by summing the respective parts of all
     * the wordlets that make up the line.
     */
    var measure_wordlets = function(wordlets, start, end) {
        var add = function(a, b) { return a + b; };
        var slice = wordlets.slice(start, end);
        while (slice.length && slice[0].type === "glue") {
            slice = slice.slice(1);
        }
        while (slice.length && slice[slice.length - 1].type === "glue") {
            slice.pop();
        }
        var additional_width = 0;
        // If the line ends mid-word, we'll have to include the width
        // of the hyphen.
        if (wordlets[end].type === "penalty") {
            // TODO magic number hyphen width
            additional_width += options.hyphen_width;
        }
        var width = _.reduce(_.pluck(slice, "width"), add, 0) + additional_width;
        var stretch = _.reduce(_.filter(_.pluck(slice, "stretch"), _.identity), add, 0);
        var shrink = _.reduce(_.filter(_.pluck(slice, "shrink"), _.identity), add, 0);
        var glues = _.filter(slice, function(w) {return w.type === "glue";}).length;
        return {width: width, stretch: stretch, shrink: shrink, glues: glues};
    };

    /**
     * Given an index of a wordlet, and a set of possible line breaks made
     * previous to that wordlet, find_breaks_i determines all the ways we might
     * make a line break at the specified wordlet. It also determines which of
     * the line breaks in the list of possible line breaks are still relevant to
     * choosing future breaks.
     */
    var find_breaks_i = function(wordlets, index, breaks, line_lengths) {
        var old_breaks = [];
        var new_break;
        _.each(breaks, function (previous_break) {
            var line_length = line_lengths[previous_break.line_number];
            var measure = measure_wordlets(wordlets,
                                           previous_break.index,
                                           index);
            var compression =  line_length - measure.width;

            if (compression > measure.shrink &&
                compression < measure.stretch) {
                var cost = previous_break.cost;

                // Compression cost
                cost += Math.pow(compression, 2);

                // Breaking-on-a-penalty cost
                if (wordlets[index].type === "penalty") {
                    cost += wordlets[index].cost;
                }
                // Too-much-variation-in-compression cost;
                cost += Math.pow(previous_break.compression - compression, 2);

                if (!new_break || cost <= new_break.cost)
                    new_break = {
                        wordlet: wordlets[index],
                        cost: cost,
                        compression: compression,
                        width: measure.width,
                        glues: measure.glues,
                        index: index,
                        previous: previous_break,
                        line_number: previous_break.line_number + 1
                    };
            }

            if ((measure.width + measure.shrink) < line_length)
                old_breaks.push(previous_break);
        });
        if (new_break)
            old_breaks.push(new_break);
        return old_breaks;
    };

    /**
     * Loops through each wordlet in a paragraph, and uses find_breaks_i to
     * discover any possible line breaks at that point; once it reaches the end,
     * it chooses the lowest-cost set
     * of breaks, which it returns.
     */
    var find_breaks = function(wordlets, line_lengths) {
        var breaks = [{
            wordlet: {},
            cost: 0,
            compression: 0,
            index: 0,
            previous: null,
            line_number: 0
        }];
        wordlets.push({type:"glue", width:0});
        _.each(wordlets, function(wordlet, index) {
            if (wordlet.type === "penalty" || wordlet.type === "glue") {
                breaks = find_breaks_i(wordlets, index, breaks, line_lengths);
            }
        });
        var ret = _.min(breaks.reverse(), function(break_chain) {
            return break_chain.cost;
        });
        return reify_break_chain(ret);
    };

    /**
     * The linked list that find_breaks produces is kinda difficult to work
     * with; this function munges it into a cleaner array, with useful
     * information about spacing.
     *
     * Each element in the resulting list has the following info:
     *
     * - break_element: the wordlet on which to break the line.
     * - first_spacing: the word-spacing for the first n words
     * - rest_spacing: the word_spacing for the remaining words
     * - first_count: the number n
     * - glues_so_far: 0. Used by despanify.
     * - current_spacing: Used by despanify.
     */
    var reify_break_chain = function(chain) {
        var rets = [{
            glues_so_far: 0,
            first_spacing: 0,
            current_spacing: 0,
            first_count: 100,
            rest_spacing: 0
        }];
        while(chain.previous) {
            var compression = chain.compression;
            var spacing = compression / chain.glues;
            var first_spacing = spacing < 0 ? Math.ceil(spacing) : Math.floor(spacing);
            var remainder = compression - (first_spacing * chain.glues);
            var rest_count =  Math.abs(
                remainder < 0 ? Math.ceil(remainder) : Math.floor(remainder));
            var rest_spacing = compression < 0 ? first_spacing - 1 : first_spacing + 1;
            rets.push({
                break_element: chain.wordlet.span,
                glues_so_far: 0,
                first_spacing: first_spacing,
                current_spacing: first_spacing,
                first_count: chain.glues - rest_count,
                rest_spacing: rest_spacing
            });
            chain = chain.previous;
        }
        return rets;
    };

    /**
     * PART III: REFORMATTING THE TEXT
     */

    /**
     * This is the only chunk of code I'm ashamed of. It turns all those
     * horrible spans back into a more sane arrangement of two spans per line
     * (two because we have to simulate sub-pixel word-spacing, so one span
     * might be 1px spacing and the other 2, to make an average
     * one-point-something.
     *
     * It is horrible because of a particular edge-case: where the line break
     * occurs in the middle of, for instance, a <strong> tag. In that particular
     * case, there must be more than two spans, to take care of both the text
     * inside the strong tag (which will have two or more different spacings)
     * and the text oustide it.
     *
     * So apologies aside, this is messy but necessary.
     */
    var despanify_element = function(elt, linebreaks, divisor) {
        // cbreak is the current line break.
        var cbreak = linebreaks[linebreaks.length - 1];
        var text = [];
        var open_span = function(cbreak) {
            text.push('<span style="word-spacing: ' +
                      cbreak.current_spacing +
                      'px">');
        };
        var close_span = function() {
            text.push("</span>");
        };

        open_span(cbreak);
        _.each(elt.children, function(bit) {
            var $bit = $(bit);
            // If the node has children, it's not a wordlet. Recurse.
            if (bit.children.length) {
                close_span();

                despanify_element(bit, linebreaks);
                text.push(bit.outerHTML);

                open_span(cbreak);

            // Otherwise, flatten out the span-per-syllable silliness.
            } else {
                var bittext = bit.innerHTML.slice(0, bit.innerHTML.length/divisor);
                // If this element is the element we're supposed to break on,
                // add a line break!
                if (cbreak && bit === cbreak.break_element) {
                    // If we're mid-word (a penalty) add a hyphen.
                    close_span();
                    if ($bit.attr("class") == "penalty")
                        text.push("-");
                    text.push(bittext);
                    linebreaks.pop();
                    text.push('<br />');

                    cbreak = linebreaks[linebreaks.length - 1];
                    open_span(cbreak);

                } else if ($bit.attr("class") === "box") {
                    text.push(bittext);

                } else if ($bit.attr("class") === "glue") {
                    text.push(bittext);
                    cbreak.glues_so_far++;
                    if (cbreak.glues_so_far === cbreak.first_count) {
                        // It's time to change to a different word spacing.
                        cbreak.current_spacing = cbreak.rest_spacing;
                        close_span();
                        open_span(cbreak);
                    }
                }
            }
        });
        close_span();
        $(elt).html(text.join(""));
    };

    var unjust = function($thing) {
        var a = $($thing);
        a.each(function(i, e) {
            spanify_element(e);
            $(e).css("text-align: justify");
            var line_length = line_lengths(e);
            $(e).html($(e).html().replace(/<\/span> ?/g, "<\/span><br>"));
            $(e).css("text-align", "left");
            n_times_bigger(e, 10);
            var wordlets = list_wordlets(e, 10);
            line_length.push(line_length[line_length.length - 1]);
            var best_breaks = find_breaks(wordlets, line_length);
            despanify_element(e, best_breaks, 10);
        });
    };
    unjust.options = options;
    return unjust;
};
