import { writeFileSync } from "fs";
import { ofetch } from "ofetch";
import { format } from "prettier";
import { stringify } from "yaml";

// Define interfaces for GitHub discussion form types
type CheckboxOption = {
  label: string;
} & Partial<{
  required: boolean;
}>;

interface CheckboxAttributes {
  label: string;
  description?: string;
  options: CheckboxOption[];
}

interface MarkdownAttributes {
  value: string;
}

interface InputAttributes {
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
}

interface FormElement {
  type: string;
  id?: string;
  attributes:
    | CheckboxAttributes
    | MarkdownAttributes
    | InputAttributes
    | Record<string, any>;
  validations?: Record<string, any>;
}

interface FormTemplate {
  title: string;
  body: FormElement[];
}

// Fetch all event pages from the wiki
const url = `https://wiki.creatorsgarten.org/api/contentsgarten/search?${new URLSearchParams(
  {
    input: JSON.stringify({
      prefix: "Events/",
    }),
  }
)}`;

const response = await ofetch<{
  result: {
    data: {
      results: {
        pageRef: string;
        frontMatter: {
          event: {
            unlisted?: boolean;
            date: string;
            name: string;
          };
        };
      }[];
    };
  };
}>(url);

console.log(response);

// Sort events by date (newest first)
const events = response.result.data.results
  .filter((event) => !event.frontMatter.event.unlisted)
  .sort(
    (a, b) =>
      new Date(b.frontMatter.event.date).getTime() -
      new Date(a.frontMatter.event.date).getTime()
  );

// Generate the form template
const formTemplate: FormTemplate = {
  title: "Event contributor list update request",
  body: [
    {
      type: "markdown",
      attributes: {
        value: `
# Bulk update event contribution list

This form is for contributors who have participated in multiple Creatorsgarten events but don't see themselves on the event contributor lists.

Adding yourself to individual event pages can be tedious when you've been involved in multiple events, so we created this form to streamline the process.

> [!IMPORTANT]
Before proceeding, make sure you have a public profile on our wiki. Your name must be listed on the [People page](https://creatorsgarten.org/wiki/People).
If you don't have a profile yet, see [creating a public profile](https://creatorsgarten.org/wiki/People#creating-a-public-profile).
        `.trim(),
      },
    },
    {
      type: "checkboxes",
      attributes: {
        label: "Public profile confirmation",
        description: "Please confirm that you have created a public profile",
        options: [
          {
            label: "I have already created a public profile on the wiki",
            required: true,
          },
        ],
      },
    },
    {
      type: "markdown",
      attributes: {
        value: `
## Event contributions

Select the events you've contributed to and specify your role in each event.
        `.trim(),
      },
    },
  ],
};

// Add each event to the form
for (const event of events) {
  const slug = event.pageRef.replace("Events/", "");
  const eventName = event.frontMatter.event.name;
  const eventDate = new Date(event.frontMatter.event.date).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
    }
  );

  const checkboxElement: FormElement = {
    type: "checkboxes",
    id: `event_${slug}`,
    attributes: {
      label: `${event.frontMatter.event.date.slice(0, 4)} - "${eventName}" [${slug}]`,
      options: [
        { label: "I volunteered to help in this event" },
        { label: "I was a speaker or presenter in this event" },
        { label: "I was a director of this event" },
      ],
    },
  };

  formTemplate.body.push(checkboxElement);
}

// Add submission note
formTemplate.body.push({
  type: "markdown",
  attributes: {
    value: `
## Thank you!

Your contribution information will be reviewed and added to the respective event pages. This process may take a few days.
    `.trim(),
  },
});

// Convert to YAML and write to file
const yamlContent = stringify(formTemplate, {
  lineWidth: 0,
});
const formattedYaml = await format(yamlContent, { parser: "yaml" });
writeFileSync(
  ".github/DISCUSSION_TEMPLATE/event-contribution-update.yml",
  formattedYaml
);

console.log("Successfully generated event-contribution-update.yml");
