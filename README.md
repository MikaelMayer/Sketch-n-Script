# How to deploy

## Installation

1. *Install clasp*. Open a terminal anywhere, and run:

       npm i @google/clasp -g

2. *Log into clasp*. Open a terminal anywhere, and run:

       clasp login

## Integrate Sketch-n-Script in a Doc for testing

1. Create a Google Doc. Open `Tools > Script editor`.
   Give the project a `NAME` and save it.
   The files in this project template will soon be overriden.
   
1. Open `File > Project properties` and copy the Script ID value.

1. Pull a fresh clone of
   [Sketch-n-Script](https://github.com/MikaelMayer/Sketch-n-Script)
   and then `cd Sketch-n-Script`.

1. Run `clasp clone NAME`.

1. The last step will create a starter skeleton `Code.js` file.
   Run `git checkout Code.js` to revert to the version from
   `Sketch-n-Script`.

1. Create a file `.clasp.json` that contains the the following:

       {"scriptId":"XXX"}

   Replace `XXX` by the Script ID obtained above.

1. Try making a change to `Code.js`
   (e.g. change the string argument to `.setSetTile').
   Then run `clasp push`.

   If asked for confirmation, enter `y` for Yes.

   You might have to go to https://script.google.com/home/usersettings to activate
   the Script API (change it from Off to On), and then re-run `clasp push`.

1. Refresh your script page from the browser,
   or run `clasp open` to open the script in a new browser window.

1. Go to `Run > Run function > onOpen`.
   Accept the permissions.
   A menu appears under the `Add-on` menu, click it, then `Start` to open the side bar.

1. (I had trouble with the previous step: Instead, I:)
   Open `Run > Test as add-on...` and then picke a Doc on which to test `NAME`.
   Then, from inside that Doc, go to `Add-ons > NAME > Start` to launch the add-on.

Now the add-on is working for this script.

## Developing the Sketch-n-Script add-on

You can develop the add-on locally or in the online script editor.
To push changes made locally, run

    clasp push

To pull changes made online, run

    clasp pull

**/!\ Be careful if you make changes locally AND online.**
The last two commands will overwrite each other's file.

If you made changes both locally and online, do the following.  
Run locally:

    git stash
    clasp pull
    git stash pop
    clasp push

So that now the changes have been merged and are in sync.
Remember to commit any meaningful changes.

**/!\ Always pull your online changes locally before merging other branches locally.**

## Ignore files

If you don't want that clasp push some files or folders, note that `clasp` ignores files

* That start with a .
* That don't have an accepted file extension
* That are ignored (filename matches a glob pattern in the `.claspignore` file)

## Updating the javascript parser:

If running the first time, run:

    npm install -s pegjs
    npm install uglify-js -g

Then:

    make buildjsparser

This will create the file `update/jsparser-min.js`

## Publishing the add-on (for authors only)

* Make sure all changes are pushed online.
* Make sure `.clasp.json` is referring to the correct script ID.
* Go to File > Manage version, enter a name for this version, and click on "Save a new version", then "Ok"
* In the online interface for the script editor, go to:
  Publish > Deploy as a Google Docs add-on. On the top right, select the name of the version you just saved.
  Click Update published project.
  It will lead you to the developer tools where you can update the documentation.

## Pull requests welcome!
  
More instructions about the clasp command line can be found here:
https://codelabs.developers.google.com/codelabs/clasp/

