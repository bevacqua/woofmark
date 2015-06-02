# woofmark

> Barking up the DOM tree. A modular, progressive, and beautiful Markdown and HTML editor

Browser support includes every sane browser and **IE9+**.

# Features

- Small and focused
- Progressive, enhance a raw `<textarea>`
- Markdown, HTML, and WYSIWYG input modes
- Text selection persists even across input modes!
- Entirely customizable styles
- Bring your own parsers

# Screenshot in the wild

[![woofmark-stompflow][3]][4]

<sub>_Look and feel is meant to blend into your designs_</sub>

# Install

You can get it on npm.

```shell
npm install woofmark --save
```

Or bower, too.

```shell
bower install woofmark --save
```

# `woofmark.find(textarea)`

Returns a `woofmark` instance associated with `textarea`, or `null` if none exists. When `woofmark(textarea, options?)` is called, `woofmark.find` will be used to look up an existing instance, which gets immediately returned.

# `woofmark(textarea, options?)`

Adds rich editing capabilities to a `textarea` element.

### `options.parseMarkdown`

A method that's called by `woofmark` whenever it needs to parse Markdown into HTML. This way, editing user input is decoupled from a Markdown parser. We suggest you use [megamark][1] to parse Markdown. This parser is used whenever the editor switches from Markdown mode into HTML or WYSIWYG mode.

```js
woofmark(textarea, {
  parseMarkdown: require('megamark')
});
```

For optimal consistency, your `parseMarkdown` method should match whatever Markdown parsing you do on the server-side.

### `options.parseHTML`

A method that's called by `woofmark` whenever it needs to parse HTML or a DOM tree into Markdown. This way, editing user input is decoupled from a DOM parser. We suggest you use [domador][2] to parse HTML and DOM. This parser is used whenever the editor switches to Markdown mode, and also when [.value()](#value) is called while in the HTML or WYSIWYG modes.

```js
woofmark(textarea, {
  parseHTML: require('domador')
});
```

If you're implementing your own `parseHTML` method, note that `woofmark` will call `parseHTML` with either a DOM element or a Markdown string.

While the `parseHTML` method will never map HTML back to the original Markdown in 100% cases, _(because you can't really know if the original source was plain HTML or Markdown)_, it should strive to detokenize whatever special tokens you may allow in `parseMarkdown`, so that the user isn't met with inconsistent output when switching between the different editing modes.

A test of _sufficiently good-citizen_ behavior can be found below. This is code for _"Once an input Markdown string is parsed into HTML and back into Markdown, any further back-and-forth conversions should return the same output."_ Ensuring consistent back-and-forth is ensuring humans aren't confused when switching modes in the editor.

```js
var parsed = parseHTML(parseMarkdown(original));
assert.equal(parseHTML(parseMarkdown(parsed)), parsed);
```

As an example, consider the following piece of Markdown:

```markdown
Hey @bevacqua I _love_ [woofmark](https://github.com/bevacqua/woofmark)!
```

Without any custom Markdown hooks, it would translate to HTML similar to the following:

```html
<p>Hey @bevacqua I <em>love</em> <a href="https://github.com/bevacqua/woofmark">woofmark</a>!</p>
```

However, suppose we were to add a tokenizer in our `megamark` configuration, like below:

```js
woofmark(textarea, {
  parseMarkdown: function (input) {
    return require('megamark')(input, {
      tokenizers: [{
        token: /(^|\s)@([A-z]+)\b/g,
        transform: function (all, separator, id) {
          return separator + '<a href="/users/' + id '">@' + id + '</a>';
        }
      }]
    });
  },
  parseHTML: require('domador')
});
```

Our HTML output would now look slightly different.

```html
<p>Hey <a href="/users/bevacqua">@bevacqua</a> I <em>love</em> <a href="https://github.com/bevacqua/woofmark">woofmark</a>!</p>
```

The problem is that `parseHTML` doesn't know about the tokenizer, so if you were to convert the HTML back into Markdown, you'd get:

```markdown
Hey [@bevacqua](/users/bevacqua) I _love_ [woofmark](https://github.com/bevacqua/woofmark)!
```

The solution is to let `parseHTML` _"know"_ about the tokenizer, so to speak. In the example below, `domador` is now aware that links that start with `@` should be converted back into something like `@bevacqua`.

```js
woofmark(textarea, {
  parseMarkdown: function (input) {
    return require('megamark')(input, {
      tokenizers: [{
        token: /(^|\s)@([A-z]+)\b/g,
        transform: function (all, separator, id) {
          return separator + '<a href="/users/' + id '">@' + id + '</a>';
        }
      }]
    });
  },
  parseHTML: function (input) {
    return require('domador')(input, {
      transform: function (el) {
        if (el.tagName === 'A' && el.innerHTML[0] === '@') {
          return el.innerHTML;
        }
      }
    });
  }
});
```

This kind of nudge to the Markdown compiler is particularly useful in simpler use cases where you'd want to preserve HTML elements entirely when they have CSS classes, as well.

### `options.fencing`

Prefers to wrap code blocks in "fences" _(GitHub style)_ instead of indenting code blocks using four spaces. Defaults to `true`.

### `options.markdown`

Enables Markdown user input mode. Defaults to `true`.

### `options.html`

Enables HTML user input mode. Defaults to `true`.

### `options.wysiwyg`

Enables WYSIWYG user input mode. Defaults to `true`.

### `options.editable`

If `options.wysiwyg` mode is enabled, `editable` is the DOM element that's used to display the editable content.

### `options.storage`

Enables this particular instance `woofmark` to remember the user's preferred input mode. If enabled, the type of input mode will be persisted across browser refreshes using `localStorage`. You can pass in `true` if you'd like all instances to share the same `localStorage` property name, but you can also pass in the property name you want to use, directly. Useful for grouping preferences as you see fit.

### `options.images`

If you wish to set up file uploads, _in addition to letting the user just paste a link to an image (which is always enabled)_, you can configure `options.images` like below.

```js
{
  // http method to use, defaults to PUT
  method: 'PUT',

  // endpoint where the images will be uploaded to, required
  url: '/uploads',

  // optional text describing the kind of files that can be uploaded
  restriction: 'GIF, JPG, and PNG images',

  // what to call the FormData field?
  key: 'woofmark_upload',

  // should return whether `e.dataTransfer.files[i]` is valid, defaults to a `true` operation
  validate: function isItAnImageFile (file) {
    return /^image\/(gif|png|p?jpe?g)$/i.test(file.type);
  }
}
```

### `options.attachments`

Virtually the same as `images`, except an anchor `<a>` tag will be used instead of an image `<img>` tag.

### `options.xhr`

If you want to use either `options.images` or `options.attachments` for file uploads, you'll have to tell `woofmark` how to communicate with the servers. You can use the `xhr` module for this, or anything that exposes a similar API.

```js
{
  xhr: require('xhr')
}
```

The server will receive the file upload as `req.files[key]` _(Express)_. Afterwards you should respond with the following:

- Status code between `200` and `299` if the upload succeeded
- A JSON object in the response body, containing an `href` and a `title`

Example:

```js
{
  "href": "http://localhost:9000/img/2015060123502510300.png",
  "title": "Screen Shot 2015-06-01 at 21.44.35 (43.82 KB)"
}
```

# `woofmark.strings`

To enable localization, `woofmark.strings` exposes all user-facing messages used in woofmark. Make sure not to replace `woofmark.strings` with a new object, as a reference to it is cached during module load.

# License

MIT

[1]: https://github.com/bevacqua/megamark
[2]: https://github.com/bevacqua/domador
[3]: http://i.imgur.com/AhwXSLu.png
[4]: http://bevacqua.github.io/woofmark
