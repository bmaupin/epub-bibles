'use strict';

import Epub, { IChapter, IEpubGenOptions } from 'epub-gen';
const fsPromises = require('fs').promises;

const DATA_DIRECTORY = '../data';

const generateBible = async (languageCode: string, bibleName: string) => {
  const option = {
    appendChapterTitles: false,
    author: '',
    content: [] as IChapter[],
    // TODO
    // cover: "http://demo.com/url-to-cover-image.jpg", // Url or File path, both ok.
    lang: languageCode,
    title: bibleName,
  } as IEpubGenOptions;

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
        `${DATA_DIRECTORY}/${languageCode}/${bibleName}/${bookDirectory}/${chapterFile}`
      );

      option.content.push({
        data: chapterData,
        // TODO: this makes it so that the content isn't even available...
        // excludeFromToc: true,
        title: chapterTitle,
      });
    }
  }

  new Epub(option, `../${bibleName}.epub`);
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
