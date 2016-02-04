# woofmark

> Barking up the DOM tree. A modular, progressive, and beautiful Markdown and HTML editor

Browser support includes every sane browser and **IE9+**.

# Demo

[![woofmark-stompflow][3]][4]

Try out the [demo][4]!

# Features

- Small and focused
- Progressive, enhance a raw `<textarea>`
- Markdown, HTML, and WYSIWYG input modes
- Text selection persists even across input modes!
- Built in Undo and Redo
- Entirely customizable styles
- Bring your own parsers

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

Returns an [editor](#editor) object associated with a `woofmark` instance, or `null` if none exists for the `textarea` yet. When `woofmark(textarea, options?)` is called, `woofmark.find` will be used to look up an existing instance, which gets immediately returned.

# `woofmark(textarea, options?)`

Adds rich editing capabilities to a `textarea` element. Returns an [editor](#editor) object.

### `options.parseMarkdown`

A method that's called by `woofmark` whenever it needs to parse Markdown into HTML. This way, editing user input is decoupled from a Markdown parser. We suggest you use [megamark][1] to parse Markdown. This parser is used whenever the editor switches from Markdown mode into HTML or WYSIWYG mode.

```js
woofmark(textarea, {
  parseMarkdown: require('megamark')
});
```

For optimal consistency, your `parseMarkdown` method should match whatever Markdown parsing you do on the server-side.

### `options.parseHTML`

A method that's called by `woofmark` whenever it needs to parse HTML or a DOM tree into Markdown. This way, editing user input is decoupled from a DOM parser. We suggest you use [domador][2] to parse HTML and DOM. This parser is used whenever the editor switches to Markdown mode, and also when [.value()](#editorvalue) is called while in the HTML or WYSIWYG modes.

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

### Preserving Selection Across Input Modes

Note that both `megamark` and `domador` support a special option called `markers`, needed to preserve selection across input modes. Unless your `parseHTML` function supports this option, you'll lose that functionality when providing your own custom parsing functions. That's one of the reasons we strongly recommend using `megamark` and `domador`.

### `options.fencing`

Prefers to wrap code blocks in "fences" _(GitHub style)_ instead of indenting code blocks using four spaces. Defaults to `true`.

### `options.markdown`

Enables Markdown user input mode. Defaults to `true`.

### `options.html`

Enables HTML user input mode. Defaults to `true`.

### `options.wysiwyg`

Enables WYSIWYG user input mode. Defaults to `true`.

### `options.defaultMode`

Sets the default `mode` for the editor.

### `options.storage`

Enables this particular instance `woofmark` to remember the user's preferred input mode. If enabled, the type of input mode will be persisted across browser refreshes using `localStorage`. You can pass in `true` if you'd like all instances to share the same `localStorage` property name, but you can also pass in the property name you want to use, directly. Useful for grouping preferences as you see fit.

<sub>Note that the mode saved by storage is always preferred over the default mode.</sub>

### `options.render.modes`

This option can be set to a method that determines how to fill the Markdown, HTML, and WYSIWYG mode buttons. The method will be called once for each of them.

###### Example

```js
woofmark(textarea, {
  render: {
    modes: function (button, id) {
      button.className = 'woofmark-mode-' + id;
    }
  }
});
```

### `options.render.commands`

Same as `options.render.modes` but for command buttons. Called once on each button.

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

# `editor`

The `editor` API allows you to interact with `woofmark` editor instances. This is what you get back from `woofmark(textarea, options)` or `woofmark.find(textarea)`.

### `editor.addCommand(combo, fn)`

Binds a keyboard key combination such as `cmd+shift+b` to a method _using [kanye][5]_. Please note that you should always use `cmd` rather than `ctrl`. In non-OSX environments it'll be properly mapped to `ctrl`. When the combo is entered, `fn(e, mode, chunks)` will be called.

- `e` is the original event object
- `mode` can be `markdown`, `html`, or `wysiwyg`
- `chunks` is a [chunks](#chunks) object, describing the current state of the editor

In addition, `fn` is given a `this` context similar to that of Grunt tasks, where you can choose to do nothing and the command is assumed to be synchronous, or you can call `this.async()` and get back a `done` callback like in the example below.

```js
editor.addCommand('cmd+j', function jump (e, mode, chunks) {
  var done = this.async();
  // TODO: async operation
  done();
});
```

When the command finishes, the editor will recover focus, and whatever changes where made to the `chunks` object will be applied to the editor. All commands performed by `woofmark` work this way, so please take a look [at the source code][6] if you want to implement your own commands.

### `editor.addCommandButton(id, combo?, fn)`

Adds a button to the editor using an `id` and an event handler. When the button is pressed, `fn(e, mode, chunks)` will be called with the same arguments as the ones passed if using [`editor.addCommand(combo, fn)`](#editoraddcommandcombo-fn).

You can optionally pass in a `combo`, in which case `editor.addCommand(combo, fn)` will be called, in addition to creating the command button.

### `editor.runCommand(fn)`

If you just want to run a command without setting up a keyboard shortcut or a button, you can use this method. Note that there won't be any `e` event argument in this case, you'll only get `mode, chunks` passed to `fn`. You can still run the command asynchronously using `this.async()`.

### `editor.parseMarkdown()`

This is the same method passed as an option.

### `editor.parseHTML()`

This is the same method passed as an option.

### `editor.destroy()`

Destroys the `editor` instance, removing all event handlers. The editor is reverted to `markdown` mode, and assigned the proper Markdown source code if needed. Then we go back to being a plain old and dull `<textarea>` element.

### `editor.value()`

Returns the current Markdown value for the `editor`.

### `editor.editable`

If `options.wysiwyg` then this will be the `contentEditable` `<div>`. Otherwise it'll be set to `null`.

### `editor.mode`

The current `mode` for the editor. Can be `markdown`, `html`, or `wysiwyg`.

### `editor.setMode(mode)`

Sets the current `mode` of the editor.

### `editor.showLinkDialog()`

Shows the insert link dialog as if the button to insert a link had been clicked.

### `editor.showImageDialog()`

Shows the insert image dialog as if the button to insert a image had been clicked.

### `editor.showAttachmentDialog()`

Shows the insert attachment dialog as if the button to insert a attachment had been clicked.

### `editor.history`

Exposes a few methods to gain insight into the operation history for the `editor` instance.

#### `editor.history.undo()`

Undo the last operation.

#### `editor.history.redo()`

Re-applies the most recently undone operation.

#### `editor.history.canUndo()`

Returns a boolean value indicating whether there are any operations left to undo.

#### `editor.history.canRedo()`

Returns a boolean value indicating whether there are any operations left to redo.

## `chunks`

<sub>_Please ignore undocumented functionality in the `chunks` object._</sub>

Describes the current state of the editor. This is the context you get on command event handlers such as the method passed to `editor.runCommand`.

Modifying the values in a `chunks` object during a command will result in changes to the user input in such a way that Undo and Redo can be taken care of automatically on your behalf, basically by going back to the previous _(or next)_ chunks state in the `editor`'s internal history.

#### `chunks.selection`

The currently selected piece of text in the editor, regardless of input `mode`.

#### `chunks.before`

The text that comes before `chunks.selection` in the editor.

#### `chunks.after`

The text that comes after `chunks.selection` in the editor.

#### `chunks.scrollTop`

The current `scrollTop` for the element. Useful to restore later in action history navigation.

#### `chunks.trim(remove?)`

Moves whitespace on either end of `chunks.selection` to `chunks.before` and `chunks.after` respectively. If `remove` has been set to `true`, the whitespace in the selection is discarded instead.

# `woofmark.strings`

To enable localization, `woofmark.strings` exposes all user-facing messages used in woofmark. Make sure not to replace `woofmark.strings` with a new object, as a reference to it is cached during module load.

# Usage with [horsey][7]

See [banksy][8] to integrate [horsey][7] into `woofmark`.

# License

MIT

[1]: https://github.com/bevacqua/megamark
[2]: https://github.com/bevacqua/domador
[3]: https://github.com/bevacqua/woofmark/blob/master/resources/demo.png
[4]: http://bevacqua.github.io/woofmark
[5]: https://github.com/bevacqua/kanye#kanyeoncombo-options-listener
[6]: https://github.com/bevacqua/woofmark/blob/master/src/html/hr.js
[7]: https://github.com/bevacqua/horsey
[8]: https://github.com/bevacqua/banksy
