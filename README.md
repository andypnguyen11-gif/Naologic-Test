# Naologic-Frontend

Angular frontend application for the Naologic work order schedule timeline take-home exercise. The app renders work orders across manufacturing work centers, supports Day/Week/Month views, and includes create, edit, delete, overlap validation, and timeline interactions.

## How To Run

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
ng serve
```

3. Open the app at:

```text
http://localhost:4200/
```

## Setup Notes

- Node.js 20+ is recommended.
- The project uses Angular CLI.
- Work orders persist in `localStorage`, so changes survive refreshes during development.
- If you want to reset back to the hardcoded sample data, clear the browser `localStorage` for `http://localhost:4200`.

## Approach

I approached the implementation in stages. First, I built the core layout and component structure: a fixed work-center column, a horizontally scrollable timeline grid, and the shared panel used for work-order creation and editing.

Once the structure was in place, I implemented the primary functionality, including Day/Week/Month timeline rendering, work-order positioning, create/edit/delete flows, form validation, overlap detection, and persistence of work-order changes.

After the core behavior was working, I focused on visual accuracy and interaction polish. I refined the styling to match the provided mockups as closely as possible, including typography, spacing, status treatments, current-period indicators, hover states, tooltips, and panel transitions.

The final pass focused on bug fixing and validation. I addressed edge cases around date handling, visible timeline ranges, proportional bar rendering, panel behavior, and interaction consistency, and then verified the main user flows across the different timescales.

## Libraries Used

- `@angular/core`, `@angular/common`, `@angular/forms`
  - Core Angular framework and reactive forms for the panel workflow and validation.
- `@ng-select/ng-select`
  - Required by the prompt for select/dropdown controls. Used for timescale and action/status dropdowns.
- `@ng-bootstrap/ng-bootstrap`
  - Required by the prompt for date picking. Used for the work-order start and end date inputs.
- `SCSS`
  - Used for component styling and for matching the provided design as closely as possible.

## Available Features

- Day / Week / Month timeline views
- Fixed work-center column with horizontally scrollable timeline
- Current-period marker
- Create, edit, and delete work orders
- Overlap validation on the same work center
- Status styling for Open, In Progress, Complete, and Blocked
- Work-order tooltips
- `localStorage` persistence for work orders

## Build

```bash
ng build
```
