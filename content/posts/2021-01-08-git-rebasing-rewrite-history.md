---
author: ["Vivek Bhadauria"]
title: "git rebasing - rewrite history"
date: 2021-01-08
tags: [Git]
ShowToc: false
---

In this post, I am going to discuss a scenario where I had to use “**_git rebasing_**” for something other than squashing commits.

Lets build up from the starting, I am going to use a short form “CR” for code review.

When I have to work on a feature, I generally cut a branch from the mainline and start development on it.

`git checkout -b feature-branch-101`

The above command will create a branch named “**_feature-branch-101_**” and make it the current branch. I start implementing the feature. Let’s say I made a commit (Commit A) and raised a CR corresponding to that commit. And continued development, till the CR comments came I did 2 more commits (Commit B and C). Now the repository scenario is something like below.

```
MAINLINE HEAD
Commit A -> This is sent for Code Review
Commit B
Commit C -> feature branch HEAD
```

Now the question is how do you address the comments that came from the CR of Commit A. What I used to do is create another commit D and address all the code review comments there. Because this is what happened right, here I am not rewriting the history. But in some cases it makes sense to make changes in commit A itself. So that Commit A is a quality commit. This is necessary in places where dependencies in projects can be taken at commit level. Lets see how to address the CR comments in Commit A itself.

Assuming you are at commit C. This is your current HEAD. You want to rebase (rewrite history) the branch from Commit A to current HEAD.

`git rebase -i HEAD~3`

Above command will open an editor where you can see your 3 commits with messages and some standard helpful messages from Git. It would look something like below

```
pick Commit_A MESSAGE_A
pick Commit_B MESSAGE_B
pick Commit_C MESSAGE_C

# Commands:
# p, pick <commit> = use commit
# r, reword <commit> = use commit, but edit the commit message
# e, edit <commit> = use commit, but stop for amending
# s, squash <commit> = use commit, but meld into previous commit
# f, fixup <commit> = like "squash", but discard this commit's log message
# x, exec <command> = run command (the rest of the line) using shell
# d, drop <commit> = remove commit
# l, label <label> = label current HEAD with a name
# t, reset <label> = reset HEAD to a label
# m, merge [-C <commit> | -c <commit>] <label> [# <oneline>]
# .       create a merge commit using the original merge commit's
# .       message (or the oneline, if no original merge commit was
# .       specified). Use -c <commit> to reword the commit message.
```

> NOTE - Before making changes have a look at vim basics for editing and saving.

To modify commit A, change “**_pick Commit_A MESSAGE_A_**” to “**_edit Commit_A MESSAGE_A_**” save and quit. As soon as you quit, git would take you to the repository state at commit A, you can address the CR comments. After the changes are done. Commit the changes by command below. This will modify your commit A.

`git commit --amend`

After commit A is modified, continue the rebase using the command below

`git rebase --continue`

Git will try to auto merge the changes of commit B and commit C on top of commit A, but if there are some merge conflicts, Git will stop at that commit and prompt you to resolve the merge conflicts. Once you resolve the conflicts, stage changes with `git add .` and commit it using `git commit --amend` and continue rebasing. You can also build your project after resolving the conflicts to make sure that the build doesn’t break.

One other scenario that you might find yourself in is that sometimes you will make all your changes after Commit C. Scenario looks something like below

```
MAINLINE HEAD
Commit A -> This is sent for Code Review
Commit B
Commit C -> feature branch HEAD
Uncommitted Changes
```

To move your uncommitted changes to Commit A, simply stash your changes by command below.

`git stash`

After you have stashed your changes, think of this as you have temporarily shelved your changes. Follow the process discussed above for rebasing, once you reach to Commit A, un-stash your changes by the command below

`git stash pop`

This will take all your shelved changes and apply to Commit A, fix merge conflicts if there are any and continue with rebasing.

Git rebasing is a very useful tool to keep the history clean. You can do other things like squashing commits, etc to keep the history clean and readable.

## References
- https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History
