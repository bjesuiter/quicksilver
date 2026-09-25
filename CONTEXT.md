# Quicksilver media processing

Quicksilver builds branching pipelines that turn one local media source into one or more files the user can save or share.

## Language

**Source**:
The original media file from which a pipeline derives all of its results.
_Avoid_: Input file

**Pipeline**:
An ordered, branching plan that derives one or more exports from a source.
_Avoid_: Conversion flow, workflow

**Media state**:
The logical media produced at a point in a pipeline, including the content and properties available to later steps. A media state is not necessarily a saved file.
_Avoid_: Intermediate file

**Step**:
A configured media operation that consumes a media state and produces the next media state.
_Avoid_: Option, setting

**Fork**:
A structural step that sends the same media state into two or more independently editable branches.
_Avoid_: Tee

**Branch**:
An ordered path of steps after a fork. A branch may contain another fork and ends in an export.
_Avoid_: Strand

**Export**:
The terminal step that makes a branch's current media available to save or share without changing its format or content.
_Avoid_: Conversion, output format

**Recipe**:
A reusable pipeline that is not tied to a particular source.
_Avoid_: Template
