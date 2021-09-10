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
  return str.replace(new RegExp(find, 'g'), replace);
};

const generateBookContentsPageData = (
  bookName: string,
  chapterFiles: string[],
  bookContentsPageIndex: number
): string => {
  let bookContentsPageData = `<h1><a href="toc.xhtml">${bookName}</a></h1>\n<p>`;
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
      bookContentsPageData += '&nbsp;| ';
    }

    sectionIndex += 1;
  }

  bookContentsPageData += '</p>';

  return bookContentsPageData;
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

      // Add a chapter title heading to each chapter with a link back to the contents page
      let chapterData = `<h1><a href="s${bookContentsPageIndex}.xhtml">${chapterTitle}</a></h1>\n`;

      chapterData += await fsPromises.readFile(
        `${DATA_DIRECTORY}/${languageCode}/${bibleName}/${bookDirectory}/${chapterFile}`,
        'utf8'
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
    for (const bibleName of ['La Bible Segond 1910']) {
      generateBible(languageCode, bibleName);
    }
  }
};

main();
