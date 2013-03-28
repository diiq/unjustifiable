== Unjustifiable ==

Does a better job of justifying text than CSS alone. Can also
cooperate with a hyphenating function; the example borrows the Hypher
hyphenator. https://github.com/bramstein/hypher.

=== More things ===

It's a dynamic programming algorithm, like Knuth and Plass, but it's
faster than Knuth and Plass. It accomplishes this by accepting
suboptimal results for one part of its cost function: the difference
in compression between a line and the succeeding line.

Given elements that have already been CSS-justified, Unjustifiable
will measure the line-lengths all on its own; so floats, indentations,
and so on, all work correctly.

It is also aware of any style changes, and words around sub-elements
-- so tags like `<strong>` and `<em>` are handled correctly.

=== Usage ===

If you're not looking for hyphenation, using Unjustifiable is as easy
as including the single file unjustifiable.js, and its two
dependencies (underscore and jquery), and then

```
 var justify = Unjustifiable({
     overhang: 0,
     stretch: 10,
 });
 justify("p");
```

Where `"p"` is a jQuery selector.

=== Dependencies ===

JQuery -- no need for anything bleeding-edge.

Underscore.js -- because I like data-flow programming.

=== Sandwich ===

I have written this instead of eating today and I am very hungry.