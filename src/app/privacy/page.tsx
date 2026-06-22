export const metadata = {
  title: 'HealthLens — Privacy & Terms',
};

export default function Privacy() {
  return (
    <main className="shell legal">
      <h1>Privacy &amp; Terms</h1>
      <p className="sub">Last updated: 2026. HealthLens is a free, open-source demonstration.</p>

      <h2 className="sec">Not a medical device</h2>
      <p>
        HealthLens is for informational and educational use only. It is not a medical device, is not
        intended to diagnose, treat, cure, or prevent any condition, and does not provide medical
        advice. Using it does not create a doctor–patient relationship. Always consult a qualified
        healthcare professional about any health question.
      </p>

      <h2 className="sec">How your data is handled</h2>
      <p>
        Any Apple Health <code>export.zip</code> you choose is parsed <strong>entirely in your web
        browser</strong>. Your health data is <strong>never uploaded</strong> to our servers or any
        third party, and nothing about your health is stored by us. Closing or refreshing the page
        discards it.
      </p>
      <p>
        There is <strong>no AI on this site</strong>. The optional &ldquo;Ask your own AI&rdquo;
        feature only generates a de-identified text summary that <em>you</em> may choose to copy into
        a separate assistant of your choosing. That action, and any data you send to that assistant,
        is entirely under your control and governed by that provider&rsquo;s terms — not ours.
      </p>

      <h2 className="sec">What we do process</h2>
      <p>
        Like any website, our host (Vercel) processes standard technical request data such as your IP
        address and browser type to serve the page. We do not set advertising or analytics cookies and
        do not build user profiles. We do not collect names, emails, or accounts.
      </p>

      <h2 className="sec">Your rights</h2>
      <p>
        Because we do not store personal data about you, there is nothing for us to access, correct,
        or delete. For questions you can contact the site owner. Where GDPR applies, the lawful basis
        for the minimal technical processing above is legitimate interest in operating the website.
      </p>

      <h2 className="sec">No warranty</h2>
      <p>
        The software and any figures shown are provided &ldquo;as is&rdquo;, without warranty of any
        kind. Calculated values (trends, efficiency indices, ranges) are approximations for general
        interest and may be inaccurate. Do not rely on them for medical decisions.
      </p>

      <p style={{ marginTop: 24 }}>
        <a href="/">← Back to the dashboard</a>
      </p>
    </main>
  );
}
