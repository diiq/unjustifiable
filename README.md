##Unjustifiable##

Text justification on the web is really hideous. See the
[sample](http://diiq.org/unjustifiable/example.html) for a sample of
how unjustifiable.js does it better.

Unjustifiable can also cooperate with a hyphenating function; the
example uses the [Hypher](https://github.com/bramstein/hypher)
hyphenator.

Unjustifiable works beautifully on Webkit browsers, well on Opera and
Firefox, and acceptably on IE8 & 9. It **will leave a ragged right on
mobile browsers**, and it's up to you to decide what to
do about that.

###Usage###

If you're not looking for hyphenation, using Unjustifiable is as easy
as including the single file unjustifiable.js, and its two
dependencies (underscore and jquery), and then

```
 var justify = Unjustifiable({
     /* options */
 });
 justify("p");
```

Where `"p"` is a jQuery selector for those elements you'd like
justified.

###Options###

- overhang: the number of pixels to leave at the end of each line.
- stretch: the max amount of additional interword spacing.
- shrink: the max amount interword spacing can be decreased.
- hyphenator: a function that takes a word, and returns an array of syllables.
- hyphen_penalty: the penalty for breaking a word and hyphenating. 1000 is default.

###Dependencies###

JQuery -- no need for anything bleeding-edge.

Underscore.js -- because I like data-flow programming.

###Internally###

It's a dynamic programming algorithm, like Knuth and Plass, but it's
faster than Knuth and Plass. The speed increase comes by accepting
suboptimal results for one part of its cost function: the difference
in compression between a line and the succeeding line.

Given elements that can be CSS justified, Unjustifiable will measure
the line-lengths all on its own; so floats, indentations, and so on,
all work correctly without additional information.

It is also aware of any style changes, and works around sub-elements
-- so tags like `<strong>`, `<em>`, and `code` are handled correctly.

###Sandwich###

I have written this instead of eating today and I am very hungry. I'm
going to get a sandwich now.

https://www.gittip.com/diiq/