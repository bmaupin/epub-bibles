## Development

#### Creating a cover image

Prerequisites:

1. Install the Standard Ebooks tools: [https://github.com/standardebooks/tools#installation](https://github.com/standardebooks/tools#installation)

1. Install the League Spartan font

   1. Go here: [https://github.com/theleagueof/league-spartan/releases](https://github.com/theleagueof/league-spartan/releases)

   1. Download the latest release

   1. Extract LeagueSpartan-2.220/static/TTF/LeagueSpartan-Regular.ttf from the downloaded file

   1. Install the font

      ```
      mkdir -p ~/.fonts/
      cp /path/to/LeagueSpartan-Regular.ttf ~/.fonts/
      fc-cache -f -v
      ```

Steps:

1. Find a public domain image to use as the cover

   - This is a nice source: [https://www.brooklynmuseum.org/opencollection/exhibitions/3207](https://www.brooklynmuseum.org/opencollection/exhibitions/3207) > _Objects_

1. Download and crop the source image

1. Create a temporary directory

   ```
   mkdir tmp
   cd tmp
   ```

1. Run `se create-draft`, e.g.

   ```
   $ se create-draft -a Anonymous -t "La Bible Segond 1910"
   ```

   - The title will go on top in a larger font, the author will go on the bottom in a smaller font
   - Use "Anonymous" for the author to exclude it from the cover image

1. Copy the image, e.g.

   ```
   $ cp ../data/fr/La\ Bible\ Segond\ 1910/cover-source.jpg anonymous_la-bible-segond-1910/images/cover.jpg
   ```

1. Build the image, e.g.

   ```
   $ se build-images anonymous_la-bible-segond-1910/
   ```

1. Build the ebook, e.g.

   ```
   $ se build --output-dir=dist anonymous_la-bible-segond-1910/
   ```

1. Extract the generated cover image, e.g.

   ```
   $ unzip -j dist/anonymous_la-bible-segond-1910.epub epub/images/cover.jpg -d .
   ```

1. Move the generated cover image somewhere

   ```
   $ mv cover.jpg ../data/fr/La\ Bible\ Segond\ 1910/
   ```

1. Cleanup

   ```
   cd ..
   rm -rf tmp
   ```
