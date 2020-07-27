# Unjustifiable

Text justification on the web is really hideous. Browsers choose to naively cram
as much as they can on each line, but this greedy algorithm leaves "loose" lines
of text, with great gaping holes.

For hundreds of years, well-justified text was considered masterful and
beautiful; only in the era of the browser have designers turned their back on it
-- and with good reason. On a browser, justified text is ugly.

*Was* ugly.

With unjustifiable, text can look like this: ![Example](./sample.png)

Note the dangling punctuation, and that text can change styles inline -- bold
words are wider, but the text is still properly aligned. Floats and other
incursions to the text are also supported.

See [my blog](http://sambleckley.com/writing/interaction-words.html) for a live example.

Unjustifiable works best when paired with a hyphenating function; I recommend
[Hypher](https://github.com/bramstein/hypher) (that's what I use.)

Unjustifiable works beautifully on Chrome and safai, and well enough on Firefox,
and Edge. It **will leave a slightly ragged right on some mobile browsers**, and
it's up to you to decide what to do about that.

## Installation

```
yarn add unjustifiable
```

## Usage

```javascript
const justify = unjustifiable();
const elements = document.querySelectorAll(".content p");
elements.forEach(justify);
```

### Options

The `unjustifiable` function takes an optional options object. Defaults are
shown below:

```javascript
const options = {
  stretch: 15,
  shrink: -1,
  overhang: 20,
  hyphenPenalty: 1000,
  hyphenator: function(w) {
    // Returns an array of hyphenatable syllables
    return [w];
  },
};
const justify = unjustifiable(options);
```

#### hyphenator

To use [Hypher](https://github.com/bramstein/hypher) for the hyphenator, install
Hypher, and then:

```javascript
const hyph = new Hypher(en_us);
const justify = unjustifiable({
  hyphenator: function(w) { return hyph.hyphenate(w); }
});
```

#### stretch

A measure of the default ability for a space to stretch wider, in px.

#### shrink

A measure of the default ability for a space to shrink smaller, in px.

#### overhang

The amount of space, in px, left for punctuation to dangle attractively over the
margins. It's usually best to style your textblocks with

```css
p {
  margin-right: -20px;
  margin-left: -20px;
}
```

(or whatever the overhang is) to ensure that the justified line of the text
appears where you expect, and the hanging punctuation... hangs.


#### HyphenPenalty

The bigger this number is, the less likely Unjustifible is to break a line
mid-word.


## Internally

It's a dynamic programming algorithm, like Knuth and Plass, but it's
faster than Knuth and Plass. The speed increase comes by accepting
suboptimal results for one part of its cost function: the difference
in compression between a line and the succeeding line.
