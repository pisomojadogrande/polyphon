# Polyphon

## Overview

I want to build a web application that, given an audio file that might have multiple voices (human and instrument), produce the equivalent sheet music.  This application will allow me to "reverse engineer" music.

## Thoughts on how we might do this

I've done only very light research on what technologies we could use here.  I came across https://basicpitch.spotify.com, which successfully broke down a clip of four-part a capella singing into a midi file that sounds somewhat close.  So it seems possible to get the audio converted to midi.

The next step would be to take the midi file and transcribe it to standard treble and bass clefs in sheet music.  I have no idea whether there's something out there that can do that.  One complexity we'll likely need to work out are places where the tempo gets stretched; we'll need to infer the fermata.  We'll also likely need to infer the key, which sounds hard.

Finally, once the notes are there, we'll need to do our best to pull the chords apart into separate musical lines.  This too sounds hard.

I'm okay with working on this project phase by phase and, at each phase, figuring out what approach might work.  The user of this application (probably just me) has musical background and might be able to provide inputs at some points.  That will likely be necessary.

## Product

This is a hobby project.  I'm probably going to be the only user.  

Eventually, though, I'll want user authentication, and each user will be able to store a limited number of projects (should be minimal storage - sheet music representation mostly).

We're going to need a way to render sheet music in the application once we get that far.  There may need to be tools to live-interact with the sheet music, for example to help identify the key.  The sheet music will also need to be exportable.

In terms of visual design, looking for clean, functional, and good visibility into what's going on.  

To control costs, I want this application to track its activity and shut itself off when it's reached some limit for the month.  We'll set the limit according to anticipated cloud costs.

Eventually it will be a paid product.  We'll use Stripe.  Our test environment will use a Stripe sandbox, and our production environment will use a live Stripe account.

## Technology choices

We'll have the code in my github repo.  I'm very comfortable in AWS and prefer cloud infrastructure choices whose costs scale to zero (so, DynamoDB preferred to relational databases; serverless preferred to always-running; etc).  I'm comfortable using CDK with instructions.

If it's not too expensive, I would like a good deployment pipeline, so that I could push code to git and have it deploy to the test environment and then approve deployments to the production environment.  Give me some options here; in past projects, I've just run CDK commands directly to deploy, which is okay, but I want to see if I can do better this time.

For programming languages, I prefer to use NodeJS for this project, but if we need to use another language to take advantage of useful OSS packages that exist, we can do that.  

Functionality should be accompanied by unit tests

Although I ultimately want this to be available through a web UI, to the extent possible, I'd like it built out of composable parts that I can run individually from the command line to the extent possible.  So, there will probably be a few discrete modules that we build.

## How we will work

This is my original idea doc.  First, I'd like you to ask any clarifying questions.

Then, as we build, we're going to have to proceed in phases.  I suggest these phases, but you can modify them, and we'll probably need to refine the later phases as we go:
1. Stand up the web application; no functionality yet
2. Accept audio file, convert to midi.  Have affordance to play back midi so the user can confirm.
3. Convert midi to sheet music.  Display converted sheet music as-is
4. These later phases will have to do with refining the sheet music.  I want to see what it looks like before we design the next features
5. At some point, we will figure out how to charge for the service.  Usage-based seems like a reasonable model.




