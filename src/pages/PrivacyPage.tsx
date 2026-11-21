import '../styles/privacy.css'

// The wording comes from specs/11-privacy-page.md and was approved by the project owner.
// Every statement describes what the site actually does: check the build notes in the spec
// before changing one, and update the date whenever the meaning changes.
export function PrivacyPage() {
  return (
    <main className="units-container privacy-page">
      <h1 tabIndex={-1}>Privacy</h1>
      <p className="text-secondary">
        Last updated: <time dateTime="2026-11-20">November 20, 2026</time>
      </p>
      <p>
        Quiz Maker is a small, free quiz site. It keeps as little about you as it can, and never
        sells or shares it. This page explains what it keeps and for how long.
      </p>

      <h2>If you don't log in</h2>
      <ul>
        <li>You can take any quiz without an account.</li>
        <li>
          Your result is saved on the server so it has a link you can share. It's deleted
          automatically after 1 day.
        </li>
        <li>
          To stop spam, the site counts how many quizzes are sent from your internet connection each
          hour. It doesn't keep your IP address: it stores a scrambled version (a salted hash) that
          can't be turned back into it, and deletes it about an hour later.
        </li>
      </ul>

      <h2>If you log in</h2>
      <p>You log in with Google or GitHub. The site never sees or stores a password.</p>
      <ul>
        <li>
          <strong>Your account:</strong> your email address and an ID from Google or GitHub, so you
          can log in again. Google and GitHub also send your name, username and profile picture. The
          site removes your name and username from your account as soon as they arrive. The link to
          your picture is kept, but the site never shows, uses or shares it.
        </li>
        <li>
          <strong>Login records:</strong> while you're logged in, the login system keeps your IP
          address and the type of browser you use with your login session, until you log out. It
          also keeps a security log of sign-ups, logins and logouts, which records your email
          address, the name Google or GitHub sent when you signed up, and sometimes your IP address.
          This log is kept by Supabase, which runs the site's logins.
        </li>
        <li>
          <strong>Your results:</strong> kept until you delete your account, so you can see them in
          your dashboard.
        </li>
        <li>
          <strong>Quizzes you make:</strong> public, so anyone can find and take them. Your name and
          account aren't shown with them.
        </li>
        <li>
          <strong>Your settings:</strong> theme, text size, contrast and font, so they follow you to
          other devices.
        </li>
        <li>
          <strong>Spam limits:</strong> the site counts how many quizzes you submit and create each
          hour, using your account ID. Each count is deleted about an hour later.
        </li>
      </ul>

      <h2>What a result contains</h2>
      <p>
        A result keeps a copy of the quiz's questions and answers as they were when you took it, the
        answers you chose, your score or personality result, when you took it, and how long it took
        if you used the timer. Anyone with a result's link can see it, but it never shows who you
        are.
      </p>

      <h2>What's kept in your browser</h2>
      <p>The site uses your browser's storage, not cookies:</p>
      <ul>
        <li>your settings</li>
        <li>your login, while you're logged in</li>
        <li>
          for a result you got without logging in: a code that lets you save it to an account later,
          removed once it's saved or expires
        </li>
        <li>
          answers to a quiz you're partway through, a quiz you're editing, and the page to return to
          after logging in. These are cleared when you close the tab.
        </li>
      </ul>

      <h2>Who else handles your data</h2>
      <p>
        The site has no ads, analytics or tracking, and loads no scripts from other companies. It
        relies on:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong>, which stores the site's data and runs logins, and{' '}
          <strong>Cloudflare</strong>, which sits in front of Supabase
        </li>
        <li>
          <strong>Vercel</strong>, which hosts the site
        </li>
        <li>
          <strong>Google</strong> or <strong>GitHub</strong>, only if you choose to log in with them
        </li>
      </ul>
      <p>
        Like any website, these companies see your IP address when your browser connects to them,
        and may keep it in their own logs under their own privacy policies.
      </p>

      <h2>Deleting your data</h2>
      <p>
        If you're logged in, open <strong>Settings</strong> and choose{' '}
        <strong>Delete account</strong>. This immediately and permanently deletes your account, your
        results, the quizzes you made, your settings and your login sessions. Three things to know:
      </p>
      <ul>
        <li>
          If someone is partway through one of your quizzes, a private copy of it is kept for up to
          24 hours so their answers can still be marked, then deleted. No one can read it.
        </li>
        <li>
          Results other people got from your quizzes keep their copy of the questions, but nothing
          that identifies you.
        </li>
        <li>Supabase's security log of your sign-ups and logins isn't deleted.</li>
      </ul>
      <p>Results can't be deleted one at a time.</p>

      <h2>Questions</h2>
      <p>
        You don't need to contact anyone to delete your data: see above. For other questions about
        this page, open an issue on the site's GitHub page:{' '}
        <a href="https://github.com/igl-myrick/quiz-maker-v2/issues">
          github.com/igl-myrick/quiz-maker-v2/issues
        </a>
        . Issues are public and need a GitHub account, so don't include your email address or
        anything else personal.
      </p>
    </main>
  )
}
