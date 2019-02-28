# How to deploy

## Installation steps

1. *Install clasp*. Open a terminal anywhere, and run:

       npm i @google/clasp -g

2. *Log into clasp*. Open a terminal anywhere, and run:

       clasp login

## Integrate Sketch-n-Script in your doc for testing

1. Make sure you have a fresh cloned version of Sketch-n-Script:
   https://github.com/MikaelMayer/Sketch-n-Script

2. Create a google docs. Open Tools > Script editor.
   Save the project and give it a name. You are going to override it
   
3. In File > Project properties, copy the Script ID's value.

4. In the cloned folder, create a file `.clasp.json`. Inside this file, write

       {"scriptId":"XXX"}

   Replace XXX by your script ID obtained at step 3.

5. On the command line, run this command to override all the files in Script.:

       clasp push

   If asked for confirmation, enter y for yes.
   You might have to go to https://script.google.com/home/usersettings to activate the Script API and re-run this command again.

6. Refresh your script page, or run `clasp open` to view the script online:

7. Go to Execute > Execute function > onOpen.
   Accept the permissions.
   A menu appears under the "Add-on" menu, click it, then Start to open the side bar.

Now the add-on is working for this script.

## Developing the add-on

You can develop the add-on locally or in the online script editor.
To push changes made locally, run

    clasp push

To pull changes made online, run

    clasp pull

/!\ Be careful if you make changes locally AND online.
The last two commands will overwrite each other's file.

If you made changes both locally and online, do the following.  
Run locally:

    git stash
    clasp pull
    git stash pop
    clasp push

So that now the changes have been merged and are in sync.
Remember to commit any meaningful changes.

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

