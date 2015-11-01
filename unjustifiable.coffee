unjustifiable = (options) ->
  options = options || {}
  _.defaults options,
    hyphenator: (w) -> [w]

    # All measurements in px.
    stretch: 15
    shrink: -1
    overhang: 20

    # This is a cost for hyphenating, which is measured in
    # mostly-meaningless units (px^2)
    hyphenPenalty: 1000

  ##
  # PART I: PARSING, HYPHENATING, AND MEASURING THE TEXT
  #

  ###
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
  ###

  glueSpan = (glue) -> "<span class='glue'>#{glue}</span>"

  boxSpan = (wordlet) -> "<span class='box'>#{wordlet}</span>"

  punctuationSpan = (wordlet) -> "<span class='punctuation'>#{wordlet}</span>"

  penaltySpan = -> "<span class='penalty'></span>"

  spanifyWord = (word) ->
    syllables = options.hyphenator(word)
    spanifiedWord = boxSpan(syllables[0])
    parts = _.map syllables, boxSpan
    parts.join penaltySpan()

  # Matches spaces and word-ending punctuation (+ look-ahead spaces)
  glueRegex = /(&nbsp;|(?:&mdash;|&rdquo;|[-,;:"”=\.\/\)\]\}\?])+(?:&nbsp;)*)/

  spanifyText = (text) ->
    text = text.replace(/\n ?/g, " ").replace(/ +/g, "&nbsp;")
    words = text.split(glueRegex)

    spannedWords = _.map words, (word, i) ->
      if word.match(glueRegex)
        glueSpan(word) + " "
      else if word
        spanifyWord(word)
      else
        ""

    spannedWords.join ""

  spanifyElement = (elt) ->
    parts = elt.childNodes
    newHtml = ""
    _.each parts, (part) ->
        if part.nodeType == 3
          # It's a text node.
          newHtml += spanifyText(part.textContent)
        else
          # It's a nested DOM elt; recurse.
          spanifyElement(part)
          newHtml += part.outerHTML

    elt.innerHTML = newHtml

  ###
  Walking the DOM in this particular way happens several times,
  so I've pulled it out into a utility function. If a node has children
  (not a text node, or an image, or anything),
  ###

  hasClass = (elt, cls) ->
    if elt.hasAttribute("class")
      elt.getAttribute("class").indexOf(cls) > -1

  walkElt = (elt, action) ->
    _.each elt.children, (bit) ->
      if hasClass(bit, "unjustifiable-ignore")
        return
      else if bit.children.length
        rec = walkElt(bit, action)
      else
        action(bit)

  ###
  listWordlets takes a DOM element that has already been spanified,
  and makes an array of dictionaries that summarizes the important
  data about the word-fragments therein. It's recursive to cope with
  nested elements (<strong>, <em>, etc.)
  ###

  listWordlets = (elt) ->
    list = []
    walkElt elt, (bit) ->
      wordlet =
        type: bit.getAttribute("class")
        span: bit
        width: bit.getClientRects()[0].width

      if wordlet.type == "glue" and bit.innerHTML.match("&nbsp;")
        wordlet.stretch = options.stretch
        wordlet.shrink = options.shrink
      else if wordlet.type == "penalty"
        wordlet.cost = options.hyphenPenalty
        wordlet.width = 0

      list.push(wordlet)

    list

  ###
  lineLengths takes an element that has been spanified and produces
  a list of line-lengths. Expects the text-block to be
  css-justified.
  ###

  lineLengths = (elt) ->
    list = []
    prevHeight = 0
    lineStart = 0
    prevOffset = null
    walkElt elt, (bit) ->
      offset = bit.getClientRects()[0]

      if prevOffset and offset.top - prevOffset.top > 2
        list.push(prevOffset.right - lineStart - options.overhang)
        lineStart = offset.left

      if not prevOffset
        lineStart = offset.left

      prevOffset = offset;

    list

  ##
  # PART II: FINDING IDEAL LINEBREAK POSITIONS
  #

  ###
  A possible line break is scored in part based on the width of the
  line it makes. We can measure that width (and the amount of
  stretching and shrinking we can do to the line) by summing the
  respective parts of all the wordlets that make up the line.
  ###

  measureWordlets = (wordlets, start, end) ->

    slice = wordlets.slice(start, end)

    while (slice.length and
           slice[0].type == "glue")
      slice = slice.slice(1)

    width = _.sum _.pluck(slice, "width")

    while (slice.length and
           slice[slice.length - 1].type == "glue")
      slice.pop()

    width: width
    stretch: _.sum _.pluck(slice, "stretch")
    shrink: _.sum _.pluck(slice, "shrink")
    glues: _.filter(slice, (w) -> w.type == "glue").length


  ###
  Given an index of a wordlet, and a set of possible line breaks
  made previous to that wordlet, findBreaksI determines all the
  ways we might make a line break at the specified wordlet. It also
  determines which of the line breaks in the list of possible line
  breaks are still relevant to choosing future breaks.
  ###

  findBreaksI = (wordlets, index, breaks, lineLengths) ->
    oldBreaks = []
    newBreak = null;

    _.each breaks, (previousBreak) ->
      lineLength = lineLengths[previousBreak.lineNumber]
      measure = measureWordlets(
        wordlets,
        previousBreak.index,
        index
      )
      compression = lineLength - measure.width

      # if this is the last wordlet, ignore stretch.
      if index == wordlets.length - 1
        compression = Math.min(compression, 0)


      if compression >= measure.shrink and compression <= measure.stretch
        cost = previousBreak.cost

        # Compression cost
        cost += Math.pow(compression, 2)

        # Breaking-on-a-penalty cost
        if wordlets[index].type == "penalty"
          cost += wordlets[index].cost

        # Too-much-variation-in-compression cost;
        cost += Math.pow(previousBreak.compression - compression, 2)

        if !newBreak || cost <= newBreak.cost
          newBreak =
            wordlet: wordlets[index]
            cost: cost
            compression: compression
            width: measure.width
            glues: measure.glues
            index: index
            previous: previousBreak
            lineNumber: previousBreak.lineNumber + 1

      # If the previous break is still "in range", keep it; but if this
      # is the last wordlet, then we must break here.
      if (measure.width + measure.shrink) < lineLength and index < wordlets.length - 1
        oldBreaks.push previousBreak

    if (newBreak)
      oldBreaks.push(newBreak)

    oldBreaks;


  ###
  Loops through each wordlet in a paragraph, and uses findBreaksI to
  discover any possible line breaks at that point; once it reaches the
  end, it chooses the lowest-cost set of breaks, which it returns.
  ###

  findBreaks = (wordlets, lineLengths) ->
    breaks = [{
      wordlet: {}
      cost: 0
      compression: 0
      index: 0
      previous: null
      lineNumber: 0
    }]
    wordlets.push {type:"glue", width:0}

    _.each wordlets, (wordlet, index) ->
      if wordlet.type == "penalty" or wordlet.type == "glue"
        breaks = findBreaksI(wordlets, index, breaks, lineLengths);

    ret = _.min breaks.reverse(), (breakChain) ->
      breakChain.cost

    reifyBreakChain(ret)


  ###
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
  ###

  reifyBreakChain = (chain) ->
    rets = [{
      gluesSoFar: 0,
      spacing: 0,
      firstCount: 100,
    }]

    while chain.previous
      compression = chain.compression
      spacing = compression / chain.glues

      rets.push
        breakElement: chain.wordlet.span,
        spacing: spacing

      chain = chain.previous;

    rets

  ##
  # PART III: REFORMATTING THE TEXT
  #

  ###
  This is the only chunk of code I'm ashamed of. It turns all those
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
  ###

  despanifyElement = (elt, linebreaks) ->
    # cbreak is the current line break.
    cbreak = linebreaks[linebreaks.length - 1]

    openSpan = (cbreak, text) ->
      text.push "<span style=\"word-spacing: #{cbreak.spacing}px\">"

    closeSpan = (text) -> text.push "</span>"

    recur = (elt) ->
      text = []
      openSpan(cbreak, text)

      _.each elt.children, (bit) ->
        # If it's a compound node, recurse
        if bit.children.length
          closeSpan(text)
          recur(bit)
          text.push(bit.outerHTML)
          openSpan(cbreak, text)

        # Otherwise, span it up
        else
          bittext = bit.innerHTML

          # If this element is the element we're supposed to break on,
          # add a line break!
          if cbreak and bit == cbreak.breakElement
            # If we're mid-word (a penalty) add a hyphen.
            if bit.getAttribute("class") == "penalty"
              text.push "-"

            text.push bittext
            linebreaks.pop()
            closeSpan(text)
            text.push "<br />"

            cbreak = linebreaks[linebreaks.length - 1]
            openSpan(cbreak, text)

          else if bit.getAttribute("class") == "box"
            text.push bittext

          else if bit.getAttribute("class") == "glue"
            text.push bittext.replace("&nbsp;", " ")

      closeSpan(text)
      elt.innerHTML = text.join ""

    recur elt


  return (elt) ->
    spanifyElement elt
    elt.style.textAlign = "justify"
    lineLength = lineLengths(elt)
    lineLength.push(lineLength[lineLength.length - 1])
    elt.style.textAlign = "left"

    wordlets = listWordlets(elt)
    bestBreaks = findBreaks(wordlets, lineLength)

    despanifyElement(elt, bestBreaks)

window.unjustifiable = unjustifiable
