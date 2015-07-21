'use strict';

module.exports = {
  placeholders: {
    bold: 'strong text',
    italic: 'emphasized text',
    quote: 'quoted text',
    code: 'code goes here',
    listitem: 'list item',
    heading: 'Heading Text',
    link: 'link text',
    image: 'image description',
    attachment: 'attachment description'
  },
  titles: {
    bold: 'Strong <strong> Ctrl+B',
    italic: 'Emphasis <em> Ctrl+I',
    quote: 'Blockquote <blockquote> Ctrl+J',
    code: 'Code Sample <pre><code> Ctrl+E',
    ol: 'Numbered List <ol> Ctrl+O',
    ul: 'Bulleted List <ul> Ctrl+U',
    heading: 'Heading <h1>, <h2>, ... Ctrl+D',
    link: 'Hyperlink <a> Ctrl+K',
    image: 'Image <img> Ctrl+G',
    attachment: 'Attachment Ctrl+Shift+K',
    markdown: 'Markdown Mode Ctrl+M',
    html: 'HTML Mode Ctrl+H',
    wysiwyg: 'Preview Mode Ctrl+P'
  },
  buttons: {
    bold: 'B',
    italic: 'I',
    quote: '\u201c',
    code: '</>',
    ol: '1.',
    ul: '\u29BF',
    heading: 'Tt',
    link: 'Link',
    image: 'Image',
    attachment: 'Attachment',
    hr: '\u21b5'
  },
  prompts: {
    link: {
      title: 'Insert Link',
      description: 'Type or paste the url to your link',
      placeholder: 'http://example.com/ "title"'
    },
    image: {
      title: 'Insert Image',
      description: 'Enter the url to your image',
      placeholder: 'http://example.com/public/image.png "title"'
    },
    attachment: {
      title: 'Attach File',
      description: 'Enter the url to your attachment',
      placeholder: 'http://example.com/public/report.pdf "title"'
    },
    types: 'You can only upload ',
    browse: 'Browse...',
    drophint: 'You can also drag files from your computer and drop them here!',
    drop: 'Drop your file here to begin upload...',
    upload: ', or upload a file',
    uploading: 'Uploading your file...',
    uploadfailed: 'The upload failed! That\'s all we know.'
  }
};
