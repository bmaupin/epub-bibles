'use strict';

import { strict as assert } from 'assert';
import { JSDOM } from 'jsdom';
import nodepub from 'nodepub';
const fsPromises = require('fs').promises;

// https://stackoverflow.com/a/69318795/399105
const Node = new JSDOM('').window.Node;

const DATA_DIRECTORY = '../data';

interface BookMetadata {
  bookCode: string;
  id: string;
  longName?: string;
  src: string;
  shortName?: string;
}

const getAuthor = (languageCode: string): string => {
  // TODO: would this be better in a JSON file? It'd be easier to contribute to...
  switch (languageCode) {
    case 'en':
      return 'Various authors';
    case 'es':
      return 'AA.VV.';
    // https://fr.wikipedia.org/wiki/AA.VV. 🤷
    case 'fr':
      return 'AA.VV.';
    default:
      throw new Error(
        `Unhandled language code when getting table of contents name: ${languageCode}`
      );
  }
};

const getTableOfContentsTitle = (languageCode: string): string => {
  // TODO: would this be better in a JSON file? It'd be easier to contribute to...
  switch (languageCode) {
    // https://ar.wikipedia.org/wiki/%D8%AC%D8%AF%D9%88%D9%84_%D9%85%D8%AD%D8%AA%D9%88%D9%8A%D8%A7%D8%AA 🤷
    case 'ar':
      return 'جدول محتويات';
    case 'en':
      return 'Table of Contents';
    case 'es':
      return 'Tabla de contenido';
    case 'fr':
      return 'Table des matières';
    default:
      throw new Error(
        `Unhandled language code when getting table of contents name: ${languageCode}`
      );
  }
};

const getEpubId = (bibleName: string): string => {
  switch (bibleName) {
    case 'Bible Segond 1910':
      return '36fc86d0-08ed-47c8-abf7-2d30227467e0';
    default:
      throw new Error(
        `Unhandled bible name when getting EPUB ID: ${bibleName}`
      );
  }
};

const getChapterNumber = (chapterFile: string): number => {
  return Number(chapterFile.slice(0, 3));
};

const replaceAll = (
  str: string,
  find: string | RegExp,
  replace: string
): string => {
  // Use a RegExp object as-is if we get one as it may contain flags, otherwise the second RegExp constructor parameter will override them
  if (typeof find === 'string') {
    return str.replace(new RegExp(find, 'g'), replace);
  } else {
    return str.replace(find, replace);
  }
};

const generateBookContentsPageData = (
  bookName: string,
  chapterFiles: string[],
  bookContentsPageIndex: number
): string => {
  // Use .toUpperCase() because some ereaders don't support text-transform: uppercase;
  let bookContentsPageData = `<h2 class="book-title"><a href="toc.xhtml">${bookName.toUpperCase()}</a></h2>\n<p>`;
  // Keep separate track of the section index per book
  let sectionIndex = bookContentsPageIndex;

  // Increment once to factor the index of this contents page
  sectionIndex += 1;

  for (const chapterFile of chapterFiles) {
    const chapterNumber = getChapterNumber(chapterFile);
    // Use non-breaking spaces here and elsewhere to prevent line breaks in the middle of the chapter entry
    const chapterTitle = replaceAll(
      `${bookName} ${chapterNumber}`,
      ' ',
      '&nbsp;'
    );
    const chapterEpubFilename = `s${sectionIndex}.xhtml`;

    bookContentsPageData += `<a href="${chapterEpubFilename}">${chapterTitle}</a>`;

    // Add separator after every chapter except the last one
    if (sectionIndex !== bookContentsPageIndex + chapterFiles.length) {
      // The normal space at the end allows a line break if needed
      bookContentsPageData += '&nbsp;• ';
    }

    sectionIndex += 1;
  }

  bookContentsPageData += '</p>';

  return bookContentsPageData;
};

const applyPunctuationFixes = (
  chapterData: string,
  languageCode: string
): string => {
  if (['ar', 'es', 'fr'].includes(languageCode)) {
    // Replace quotes with guillemets
    chapterData = replaceAll(chapterData, '“', '«');
    chapterData = replaceAll(chapterData, '”', '»');
  }

  if (languageCode === 'fr') {
    // Insert a non-breaking space before certain punctuation marks if they follow a word character
    chapterData = replaceAll(
      chapterData,
      // https://stackoverflow.com/a/65052998/399105
      /([\w\p{L}\p{M}])([;:!?])/gu,
      '$1&nbsp;$2'
    );

    // TODO: should we also do this for other languages, e.g. en, es?
    // TODO: should we also do something similar for " ?
    // Make sure « is preceded by a normal space
    chapterData = replaceAll(chapterData, /([^\s])(«)/, '$1 $2');

    // Make sure « is followed by a non-breaking space
    chapterData = replaceAll(chapterData, /(«)([^\s])/, '$1&nbsp;$2');

    // Make sure » is preceded by a non-breaking space
    chapterData = replaceAll(chapterData, /([^\s])(»)/, '$1&nbsp;$2');

    // Make sure » is followed by a normal space
    chapterData = replaceAll(chapterData, /(»)([^\s])/, '$1 $2');
  }

  return chapterData;
};

// Add a chapter title heading to each chapter with a link back to the contents page
const insertChapterTitle = (
  chapterData: string,
  bookName: string,
  chapterNumber: number,
  bookContentsPageIndex: number
): string => {
  // Replace the first verse number with the chapter title
  const openingSup = chapterData.indexOf('<sup>');
  const closingSup = chapterData.indexOf('</sup>');

  const chapterTitle =
    // Use .toUpperCase() because some ereaders don't support text-transform: uppercase;
    `<span class="chapter-title-book"><a href="s${bookContentsPageIndex}.xhtml">${bookName.toUpperCase()}</a> </span>` +
    `<span class="chapter-title-number">${chapterNumber}</span> `;

  chapterData =
    chapterData.slice(0, openingSup) +
    chapterTitle +
    chapterData.slice(closingSup + '</sup>'.length);

  return chapterData;
};

const readXmlFile = async (pathToXmlFile: string): Promise<Document> => {
  const fileContent = await fsPromises.readFile(pathToXmlFile, 'utf8');

  // https://stackoverflow.com/a/59669155/399105
  const dom = new JSDOM('');
  const parser = new dom.window.DOMParser();
  const document = parser.parseFromString(fileContent, 'text/xml');

  return document;
};

const getBooksMetadata = async (languageCode: string, bibleName: string) => {
  const booksMetadata = [] as BookMetadata[];
  const document = await readXmlFile(
    `${DATA_DIRECTORY}/${languageCode}/${bibleName}/metadata.xml`
  );

  const contentList = document.querySelectorAll(
    'publications publication structure content'
  );
  for (const contentElement of contentList) {
    booksMetadata.push({
      bookCode: contentElement.getAttribute('role')!,
      id: contentElement.getAttribute('name')!,
      src: contentElement.getAttribute('src')!,
    });
  }

  const nameList = document.querySelectorAll('names name');
  let i = 0;
  for (const nameElement of nameList) {
    assert(booksMetadata[i].id === nameElement.getAttribute('id'));

    for (const childElement of nameElement.children) {
      if (childElement.tagName === 'long') {
        booksMetadata[i].longName = childElement.textContent!;
      } else if (childElement.tagName === 'short') {
        booksMetadata[i].shortName = childElement.textContent!;
      }
    }
    i += 1;
  }

  return booksMetadata;
};

/*
 * We could just do some minimal conversion of the USX file (e.g. convert the XML tags to divs/spans and convert the
 * style attributes to class, similarly to what bible.com has done) but that would result in an unnecessarily large EPUB
 * file in the end. So instead we're doing a more aggressive conversion to native HTML elements (<p>, <blockquote>, etc)
 * as best as possible.
 */
const processElement = (
  element: Element,
  bookCode: string,
  chapterNumber: number
): string => {
  const stylesToSkip = [
    'mr', // Major section reference range
    'ms1', // Major section heading, line 1
    'ms2', // Major section heading, line 2
    'r', // Parallel passage reference
    'x', // Cross reference (https://app.thedigitalbiblelibrary.org/static/docs/usx/notes.html#note-crossreference)
    'xo', // Cross reference origin reference (https://app.thedigitalbiblelibrary.org/static/docs/usx/notes.html#usx-note-crossreference-charstyle-xo)
    'xt', // Cross reference target reference (https://app.thedigitalbiblelibrary.org/static/docs/usx/notes.html#usx-note-crossreference-charstyle-xt)
  ];

  // Skip references
  if (element.tagName === 'ref') {
    return '';
  }
  // Skip verse end elements
  else if (element.tagName === 'verse' && element.hasAttribute('eid')) {
    return '';
  }

  const style = element.getAttribute('style');
  if (!style) {
    throw new Error(
      `Style missing in ${bookCode} ${chapterNumber}: ${element.outerHTML}`
    );
  }

  let processedElement = '';

  if (stylesToSkip.includes(style)) {
    // Return immediately to avoid processing child elements
    return '';
  }

  // b (Blank line in poetry https://app.thedigitalbiblelibrary.org/static/docs/usx/parastyles.html#usx-parastyle-b)
  else if (style === 'b') {
    // This is a bit of a hack; just add an empty span element that we'll remove later
    // it basically only serves to prevent the back-to-back blockquote replacement from running
    // so the end result is separate blockquote elements with a gap between them. This seems to
    // look nicer than a <br />
    processedElement += '<span></span>';
  }

  // it
  else if (style === 'it') {
    processedElement = '<em>';
  }

  // m (Margin paragraph), p (Normal paragraph)
  else if (style === 'm' || style === 'p') {
    processedElement = '<p>';
  }

  // pi (Indented paragraph https://app.thedigitalbiblelibrary.org/static/docs/usx/parastyles.html#usx-parastyle-pi),
  // q (Poetic line https://app.thedigitalbiblelibrary.org/static/docs/usx/parastyles.html#usx-parastyle-q)
  else if (style === 'pi' || style === 'q') {
    processedElement = '<blockquote>';
  }

  // qs (Selah https://app.thedigitalbiblelibrary.org/static/docs/usx/charstyles.html#usx-charstyle-qs)
  else if (style === 'qs') {
    processedElement = '<span class="selah">';
  }

  // s (Section heading)
  else if (style === 's') {
    // TODO
    return '';
  }

  // v (Verse)
  else if (style === 'v') {
    // Get the verse number. It would probably be more "correct" to use something like <span class="verse-number"> but
    // as long as we're not using <sup> anywhere else this keeps the EPUB slightly smaller while technically being less
    // correct
    processedElement = `<sup>${element.getAttribute('number')}</sup>`;
  }

  // wj (Words of Jesus)
  else if (style === 'wj') {
    // Do nothing; some translations make these red, which wouldn't really work well on an E-reader
  }

  // Unmatched styles except ones to skip
  else {
    throw new Error(
      `Unhandled style: ${style} in ${bookCode} ${chapterNumber}`
    );
  }

  // Lots of elements may have the text directly inside (it, q, qs, wj)
  if (element.children.length === 0) {
    if (element.textContent?.trim() !== '') {
      processedElement += element.textContent;
    }
  } else {
    for (const childElement of element.childNodes) {
      if (childElement.nodeType === Node.ELEMENT_NODE) {
        processedElement += processElement(
          childElement as Element,
          bookCode,
          chapterNumber
        );
      } else if (childElement.nodeType === Node.TEXT_NODE) {
        // Only include text element contents if it's more than just whitespace; should slightly reduce EPUB file size
        if (childElement.textContent?.trim() !== '') {
          processedElement += childElement.textContent;
        }
      } else {
        throw new Error(
          `Unhandled node type in ${bookCode} ${chapterNumber}: ${childElement.nodeName} ${childElement.nodeType}`
        );
      }
    }
  }

  if (style === 'it') {
    processedElement += '</em>';
  } else if (style === 'm' || style === 'p') {
    processedElement += '</p>\n';
  } else if (style === 'pi' || style === 'q') {
    processedElement += '</blockquote>\n';
  } else if (style === 'qs') {
    processedElement += '</span>';
  }

  return processedElement;
};

// TODO: merge this with applyPunctuationFixes?
const postProcessChapterData = (chapterData: string): string => {
  // Replace back-to-back block quotes with line breaks
  chapterData = replaceAll(
    chapterData,
    '</blockquote>\n<blockquote>',
    '<br />\n'
  );

  // Remove empty span elements
  chapterData = replaceAll(chapterData, '<span></span>', '');

  return chapterData;
};

// Documentation for USX file format: https://app.thedigitalbiblelibrary.org/static/docs/usx/index.html
const processBook = async (
  languageCode: string,
  bibleName: string,
  bookMetadata: BookMetadata
) => {
  const chaptersData = [];

  const document = await readXmlFile(
    `${DATA_DIRECTORY}/${languageCode}/${bibleName}/${bookMetadata.src}`
  );

  const usxElement = document.querySelector('usx')!;

  let chapterData = '';
  let chapterNumber = 0;
  for (const element of usxElement.children) {
    // chapter
    if (element.tagName === 'chapter') {
      // Beginning chapter tag
      if (element.hasAttribute('number')) {
        chapterNumber = Number(element.getAttribute('number'));
      }

      // End chapter tag
      else if (element.hasAttribute('eid')) {
        chapterData = postProcessChapterData(chapterData);

        // TODO: Move this into a proper test?
        if (
          bibleName === 'Bible Segond 1910' &&
          ((bookMetadata.bookCode === 'GEN' && chapterNumber === 1) ||
            // q
            (bookMetadata.bookCode === 'GEN' && chapterNumber === 4) ||
            // m
            (bookMetadata.bookCode === 'NUM' && chapterNumber === 24) ||
            // it
            (bookMetadata.bookCode === 'EZR' && chapterNumber === 4) ||
            // b, qs
            (bookMetadata.bookCode === 'PSA' && chapterNumber === 3) ||
            // wj, word spacing problems
            (bookMetadata.bookCode === 'MAT' && chapterNumber === 5) ||
            // pi
            (bookMetadata.bookCode === 'JHN' && chapterNumber === 2))
        ) {
          try {
            assert(
              chapterData ===
                (await fsPromises.readFile(
                  `testdata/${bookMetadata.bookCode}${chapterNumber}.html`,
                  'utf8'
                ))
            );
          } catch (error) {
            console.log(chapterData);
            throw new Error(
              `Processed data doesn't match test data for ${bookMetadata.bookCode} ${chapterNumber}`
            );
          }
        }

        chaptersData.push(chapterData);

        // TODO
        console.log(chapterNumber);
        console.log(chapterData);
        // if (chapterNumber === 1) break;

        chapterData = '';
      }
    }

    // para
    else if (element.tagName === 'para') {
      // Ignore everything before the first chapter for now
      if (chapterNumber === 0) {
        continue;
      } else {
        chapterData += processElement(
          element,
          bookMetadata.bookCode,
          chapterNumber
        );
      }
    }

    // everything else
    else if (chapterNumber > 0) {
      throw new Error(
        `Unhandled element ${element.tagName} under USX element for ${bookMetadata.bookCode}`
      );
    }
  }

  return chaptersData;
};

const generateBible = async (languageCode: string, bibleName: string) => {
  console.log(`Generating EPUB for ${bibleName}`);

  const metadata = {
    author: getAuthor(languageCode),
    contents: getTableOfContentsTitle(languageCode),
    // TODO: write a function to get the cover image (cover.*?)
    // TODO: work around https://github.com/kcartlidge/nodepub/issues/17
    cover: `${DATA_DIRECTORY}/${languageCode}/${bibleName}/cover.jpeg`,
    // TODO: remove this (https://github.com/kcartlidge/nodepub/issues/15)
    genre: 'Non-Fiction',
    id: getEpubId(bibleName),
    // TODO: remove this (https://github.com/kcartlidge/nodepub/issues/15)
    images: [],
    language: languageCode,
    title: bibleName,
  };

  const epub = nodepub.document(metadata);

  /*
   * We could just take the styles.xml file and convert it more or less to CSS (similarly to what bible.com has done),
   * however this would result in a heavily-styled EPUB file that would not be optimized for E-readers. As most
   * E-readers already have very good default styling (margins, font sizes, line spacing)
   */
  epub.addCSS(await fsPromises.readFile('style.css', 'utf8'));

  // This should always point to the index of the current book contents page
  let bookContentsPageIndex = 1;

  const booksMetadata = await getBooksMetadata(languageCode, bibleName);

  for (const bookMetadata of booksMetadata) {
    await processBook(languageCode, bibleName, bookMetadata);

    // TODO
    // break;

    // TODO: next start parsing first book (GEN)
    // {
    //   bookCode: 'GEN',
    //   id: 'book-gen',
    //   longName: 'Genèse',
    //   src: 'release/USX_1/GEN.usx',
    //   shortName: 'Genèse'
    // },
    //
    // TODO: get book contents page logic working again
    // we could get the number of chapters from release/versification.vrs if need be;
    //   we could match the line with bookCode, then Number(line.split(' ').pop().split(':')[0])
  }

  // for (const bookDirectory of await fsPromises.readdir(
  //   `${DATA_DIRECTORY}/${languageCode}/${bibleName}`
  // )) {
  //   // Skip cover files
  //   if (bookDirectory.startsWith('cover')) continue;

  //   // Strip the book number off the directory to get the name
  //   const bookName = bookDirectory.slice(3);

  //   const chapterFiles = await fsPromises.readdir(
  //     `${DATA_DIRECTORY}/${languageCode}/${bibleName}/${bookDirectory}`
  //   );

  //   const bookContentsPageData = generateBookContentsPageData(
  //     bookName,
  //     chapterFiles,
  //     bookContentsPageIndex
  //   );
  //   epub.addSection(bookName, bookContentsPageData);

  //   for (const chapterFile of chapterFiles) {
  //     const chapterNumber = getChapterNumber(chapterFile);
  //     const chapterTitle = `${bookName} ${chapterNumber}`;

  //     let chapterData = await fsPromises.readFile(
  //       `${DATA_DIRECTORY}/${languageCode}/${bibleName}/${bookDirectory}/${chapterFile}`,
  //       'utf8'
  //     );
  //     chapterData = applyPunctuationFixes(chapterData, languageCode);
  //     chapterData = insertChapterTitle(
  //       chapterData,
  //       bookName,
  //       chapterNumber,
  //       bookContentsPageIndex
  //     );

  //     // TODO
  //     if (bookName === 'Psaumes' && chapterNumber === 3) {
  //       console.log(chapterData);
  //     }

  //     epub.addSection(
  //       chapterTitle,
  //       chapterData,
  //       // Exclude the chapter from the TOC and the contents page
  //       true
  //     );
  //   }

  //   bookContentsPageIndex += chapterFiles.length + 1;
  // }

  // await epub.writeEPUB('..', bibleName);
};

const main = async () => {
  // TODO: iterate over all languages in ../data
  for (const languageCode of ['fr']) {
    // TODO: iterate over all bibles in ../data/languageCode
    // TODO: Use the USX data (Bible Segond 1910) and delete the pseudo-HTML data (La Bible Segond 1910)
    for (const bibleName of ['Bible Segond 1910']) {
      generateBible(languageCode, bibleName);
    }
  }
};

main();
