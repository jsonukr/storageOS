# Figma — Extract Design Context

When reading a Figma frame for implementation:

Extract and document:
1. **Layout**: Auto Layout direction, gap, padding
2. **Colors**: All color variables used (reference variable names, not hex)
3. **Typography**: Font family, size, weight, line-height
4. **Spacing**: Gaps, margins, padding values
5. **Components**: List all component instances used
6. **States**: Hover, active, disabled, focus states
7. **Responsive**: Min/max width constraints, wrap behavior
8. **Icons**: Icon names and sizes

Output as structured data that Claude Code can directly translate to Tailwind CSS classes.
