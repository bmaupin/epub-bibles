'use strict';

import nodepub from 'nodepub';
const fsPromises = require('fs').promises;

const DATA_DIRECTORY = '../data';

const generateBible = async (languageCode: string, bibleName: string) => {
  const metadata = {
    author: 'Various authors',
    // TODO
    cover: '../test-cover.png',
    // TODO: can we remove this?
    genre: 'Non-Fiction',
    // TODO: use a different UUID for each bible
    id: '36fc86d0-08ed-47c8-abf7-2d30227467e0',
    // TODO
    images: [],
    language: languageCode,
    title: bibleName,
  };

  const epub = nodepub.document(metadata);

  for (const bookDirectory of await fsPromises.readdir(
    `${DATA_DIRECTORY}/${languageCode}/${bibleName}`
  )) {
    // Strip the book number off the directory to get the name
    const bookName = bookDirectory.slice(3);

    // TODO: for each book, create a contents page with all chapters

    for (const chapterFile of await fsPromises.readdir(
      `${DATA_DIRECTORY}/${languageCode}/${bibleName}/${bookDirectory}`
    )) {
      const chapterNumber = Number(chapterFile.slice(0, 3));
      const chapterTitle = `${bookName} ${chapterNumber}`;

      // TODO: add a chapter title heading to each chapter with a link back to the contents page

      const chapterData = await fsPromises.readFile(
        `${DATA_DIRECTORY}/${languageCode}/${bibleName}/${bookDirectory}/${chapterFile}`,
        'utf8'
      );

      epub.addSection(chapterTitle, chapterData);
    }
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
