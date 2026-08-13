# viveksb007.github.io

Personal blog built with [Hugo](https://gohugo.io/) and the [PaperMod](https://github.com/adityatelange/hugo-PaperMod) theme (pulled in as a git submodule).

## Setup

The theme lives in a git submodule, so a plain `git clone` leaves `themes/PaperMod` empty. Fetch it once after cloning:

```
git submodule update --init --recursive
```

If you clone fresh, you can do it in one step instead:

```
git clone --recurse-submodules <repo-url>
```

## Run locally

```
hugo server -D
```
