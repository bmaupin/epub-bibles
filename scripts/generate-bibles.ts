'use strict';

import nodepub from 'nodepub';
const fsPromises = require('fs').promises;

const DATA_DIRECTORY = '../data';

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
    case 'La Bible Segond 1910':
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

  epub.addCSS(await fsPromises.readFile('style.css', 'utf8'));

  // This should always point to the index of the current book contents page
  let bookContentsPageIndex = 1;

  for (const bookDirectory of await fsPromises.readdir(
    `${DATA_DIRECTORY}/${languageCode}/${bibleName}`
  )) {
    // Skip cover files
    if (bookDirectory.startsWith('cover')) continue;

    // Strip the book number off the directory to get the name
    const bookName = bookDirectory.slice(3);

    const chapterFiles = await fsPromises.readdir(
      `${DATA_DIRECTORY}/${languageCode}/${bibleName}/${bookDirectory}`
    );

    const bookContentsPageData = generateBookContentsPageData(
      bookName,
      chapterFiles,
      bookContentsPageIndex
    );
    epub.addSection(bookName, bookContentsPageData);

    for (const chapterFile of chapterFiles) {
      const chapterNumber = getChapterNumber(chapterFile);
      const chapterTitle = `${bookName} ${chapterNumber}`;

      let chapterData = await fsPromises.readFile(
        `${DATA_DIRECTORY}/${languageCode}/${bibleName}/${bookDirectory}/${chapterFile}`,
        'utf8'
      );
      chapterData = applyPunctuationFixes(chapterData, languageCode);
      chapterData = insertChapterTitle(
        chapterData,
        bookName,
        chapterNumber,
        bookContentsPageIndex
      );

      epub.addSection(
        chapterTitle,
        chapterData,
        // Exclude the chapter from the TOC and the contents page
        true
      );
    }

    bookContentsPageIndex += chapterFiles.length + 1;
  }

  await epub.writeEPUB('..', bibleName);
};

const main = async () => {
  // TODO: iterate over all languages in ../data
  for (const languageCode of ['fr']) {
    // TODO: iterate over all bibles in ../data/languageCode
    // TODO: Use the USX data (Bible Segond 1910) and delete the pseudo-HTML data (La Bible Segond 1910)
    for (const bibleName of ['DELETEME-La Bible Segond 1910']) {
      generateBible(languageCode, bibleName);
    }
  }
};

main();
