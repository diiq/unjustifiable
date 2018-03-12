##Unjustifiable##

Text justification on the web is really hideous. Browsers choose to
naively cram as much as they can on each line, but this leaves "loose"
lines of text, with great gaping holes.

For hundreds of years, well justified text was considered masterful
and beautiful; only in the era of the browser have designers turned
thier back on it -- and with good reason. On a browser, justified text
is ugly.

Was ugly.

See the [my blog](http://diiq.org/#!/blog/church-of-interruption)
for a sample of how unjustifiable makes it better.

Unjustifiable can cooperate with a hyphenating function; I've tucked
in [Hypher](https://github.com/bramstein/hypher) because that's how I
use it.

Unjustifiable works beautifully on Webkit browsers, well on Opera and
Firefox, and acceptably on IE8 & 9. It **will leave a slightly ragged
right on some mobile browsers**, and it's up to you to decide what to
do about that.

###Usage###

If you're interested in helping generalize
this so that it is easy to use, package-managed, and all that jazz, drop me a note -- or just open a pull request.

###Options###

- overhang: the number of pixels to leave at the end of each line.
- stretch: the max amount of additional interword spacing.
- shrink: the max amount interword spacing can be decreased.
- hyphenator: a function that takes a word, and returns an array of syllables.
- hyphen_penalty: the penalty for breaking a word and hyphenating. 1000 is default.

###Dependencies###

Requires underscore or lodash.

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
