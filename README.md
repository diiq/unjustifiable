##Unjustifiable##

Text justification on the web is really hideous. See
the (sample)[http://diiq.org/unjustifiable/example.html] for a sample of how
unjustifiable,js does it better.

Unjustifiable can alsocooperate with a hyphenating function; the
example uses the (Hypher)[https://github.com/bramstein/hypher]
hyphenator.

###Internally###

It's a dynamic programming algorithm, like Knuth and Plass, but it's
faster than Knuth and Plass. It accomplishes this by accepting
suboptimal results for one part of its cost function: the difference
in compression between a line and the succeeding line.

Given elements that have already been CSS-justified, Unjustifiable
will measure the line-lengths all on its own; so floats, indentations,
and so on, all work correctly.

It is also aware of any style changes, and words around sub-elements
-- so tags like `<strong>` and `<em>` are handled correctly.

###Usage###

If you're not looking for hyphenation, using Unjustifiable is as easy
as including the single file unjustifiable.js, and its two
dependencies (underscore and jquery), and then

```
 var justify = Unjustifiable({
     overhang: 0,
     stretch: 10,
     space: 4
 });
 justify("p");
```

Where `"p"` is a jQuery selector.

###Options###

- overhang: the number of pixels to leave at the end of each line.
- stretch: the max amount of additional interword spacing.
- shrink: the max amount interword spacing can be decreased.
- space: the basic width of a single space.
- hyphen-width: the width of a word-interrupting hyphen. Only used if a hyphenator is provided.
- hyphenator: a function that takes a word, and returns an array of syllables.
- hyphen_penalty: the penalty for breaking a word and hyphenating. 500 is default.

###Dependencies###

JQuery -- no need for anything bleeding-edge.

Underscore.js -- because I like data-flow programming.

###Sandwich###

I have written this instead of eating today and I am very hungry.

https://www.gittip.com/diiq/