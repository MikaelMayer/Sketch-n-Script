# How to deploy

## Installation steps

1. *Install clasp*. Open a terminal anywhere, and run:

       npm i @google/clasp -g

2. *Log into clasp*. Open a terminal anywhere, and run:

       clasp login

## Integrate Sketch-n-Script in your doc for testing

1. Create a google docs. Open Tools > Script editor.
   Save the project. You are going to override it
   
2. In File > Project properties, copy the Script ID's value.

3. Make sure you have a fresh cloned version of Sketch-n-Script:
   https://github.com/MikaelMayer/Sketch-n-Script

4. In the cloned folder, create a file `clasp.json`. Inside this file, write

       {"scriptId":"XXX"}

   Replace XXX by your script ID obtained at step 2.

5. On the command line, run:

       clasp push

   This command overrides all the files in Script.

6. Refresh your script page, or run `clasp open` to view the script online:

7. Execute > Execute function > onOpen

Now the add-on is working for this script.

## Pull requests welcome !
  
More instructions about the clasp command line can be found here:
https://codelabs.developers.google.com/codelabs/clasp/

