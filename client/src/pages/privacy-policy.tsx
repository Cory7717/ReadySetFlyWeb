export default function PrivacyPolicy() {
  return (
    <div>
      {/* Page Hero */}
      <div className="rsf-page-canopy px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <span className="rsf-kicker mb-4">Legal</span>
          <h1 className="mt-3 font-display text-4xl font-bold text-[#F1F5FA]">Privacy Policy</h1>
          <p className="mt-2 text-sm text-[#91a8c3]">Last Updated: March 4, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="rsf-metal-section px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="rsf-metal-panel rounded-[1.2rem] p-8 md:p-10">
            <div className="space-y-0">

              <section className="pb-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">1. Introduction</h2>
                <p className="leading-relaxed text-[#E8EDF4]">
                  Ready Set Fly (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy.
                  This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use
                  our marketplace-first aviation platform, including listings, rentals, flight-planning tools, digital
                  logbook features, training tools, our website at{" "}
                  <a href="https://readysetfly.us" className="text-[#9ec0ff] hover:underline">
                    readysetfly.us
                  </a>
                  , and our mobile application (collectively, the &quot;Platform&quot;).
                </p>
                <p className="mt-3 leading-relaxed text-[#E8EDF4]">
                  By using the Platform, you agree to the collection and use of information in accordance with this Privacy
                  Policy. If you do not agree with our policies and practices, please do not use the Platform.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">2. Information We Collect</h2>

                <h3 className="mb-2 mt-5 text-lg font-semibold text-[#F1F5FA]">2.1 Information You Provide to Us</h3>
                <ul className="mt-3 space-y-3 pl-5">
                  {[
                    { label: "Account Information:", text: "When you create an account, we collect your name, email address, and password if you use email/password authentication." },
                    { label: "Profile Information:", text: "We collect additional information you provide such as phone number, profile photo, bio, and role-related profile details." },
                    { label: "Verification Documents:", text: "To verify your identity as a pilot, instructor, aircraft owner, or service provider, we may collect pilot licenses, certificates, insurance documents, and other verification materials." },
                    { label: "Aircraft Information:", text: "If you list an aircraft, use aircraft profile features, or save aircraft assumptions for planning or ownership calculations, we collect registration numbers, make, model, specifications, photos, availability, and profile assumptions you provide." },
                    { label: "Marketplace and Directory Listings:", text: "If you create marketplace, rental, banner, or directory listings, we collect listing descriptions, pricing, media, contact details, and related business information." },
                    { label: "Flight Planning, Training, and Logbook Data:", text: "If you use planning, digital logbook, or training features, we collect the information you enter, such as saved flight plans, aircraft profiles, filing-preparation details, training progress, endorsements, lesson records, and logbook entries." },
                    { label: "Payment Information:", text: "We collect payment information necessary to process marketplace, rental, advertising, or subscription transactions, including payment method details processed by our payment processor, PayPal Business/Commerce." },
                    { label: "Messages and Support Requests:", text: "We collect and store messages you send through our platform messaging system, contact forms, or support channels." },
                  ].map(({ label, text }) => (
                    <li key={label} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span><strong className="text-[#F1F5FA]">{label}</strong> {text}</span>
                    </li>
                  ))}
                </ul>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">2.2 Information Automatically Collected</h3>
                <ul className="mt-3 space-y-3 pl-5">
                  {[
                    { label: "Usage Data:", text: "We collect information about your interactions with the Platform, including pages visited, features used, search actions, clicks, and time spent on the Platform." },
                    { label: "Device Information:", text: "We collect information about your device, including device type, operating system, browser type, and IP address." },
                    { label: "Authentication Data:", text: "When you use third-party authentication such as Google Sign-In, we receive your name, email, and profile information from those services." },
                    { label: "Analytics and Diagnostic Data:", text: "We collect operational and analytics data such as referral pages, banner interactions, search patterns, feature usage, and error diagnostics to improve platform performance, reliability, and security." },
                  ].map(({ label, text }) => (
                    <li key={label} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span><strong className="text-[#F1F5FA]">{label}</strong> {text}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">3. How We Use Your Information</h2>
                <p className="leading-relaxed text-[#E8EDF4]">We use the information we collect for the following purposes:</p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    "To create and manage your account",
                    "To verify your identity and qualifications where verification is offered",
                    "To facilitate listings, rentals, subscriptions, advertising, and other marketplace transactions",
                    "To process payments and manage financial transactions",
                    "To enable communication between users through our messaging system and listing inquiry forms",
                    "To save and synchronize planning, training, and logbook workflows across your account",
                    "To provide customer support and respond to your inquiries",
                    "To send important notifications about your account, rentals, listings, subscriptions, and transactions",
                    "To send marketing emails and product announcements when you have opted in",
                    "To prevent fraud, enforce our Terms of Service, and ensure platform security",
                    "To improve and optimize the Platform based on usage patterns",
                    "To comply with legal obligations and regulatory requirements",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">4. How We Share Your Information</h2>
                <p className="leading-relaxed text-[#E8EDF4]">We may share your information in the following circumstances:</p>

                <h3 className="mb-2 mt-5 text-lg font-semibold text-[#F1F5FA]">4.1 With Other Users</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  When you create listings, directory profiles, or submit rental or marketplace inquiries, certain
                  information such as your name, profile photo, listing details, and contact details may be visible to
                  other users as needed to facilitate that interaction.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">4.2 With Service Providers</h3>
                <p className="leading-relaxed text-[#E8EDF4]">We share information with third-party service providers who assist us in operating the Platform:</p>
                <ul className="mt-3 space-y-3 pl-5">
                  <li className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                    <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                    <span>
                      <strong className="text-[#F1F5FA]">PayPal Business/Commerce:</strong> Processes payments for rentals, listings, subscriptions, and
                      advertising. View their privacy policy at{" "}
                      <a href="https://www.paypal.com/us/legalhub/privacy-full" target="_blank" rel="noopener noreferrer" className="text-[#9ec0ff] hover:underline">
                        paypal.com/us/legalhub/privacy-full
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                    <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                    <span>
                      <strong className="text-[#F1F5FA]">Google Identity:</strong> Provides authentication services when you sign in using Google. View
                      their privacy policy at{" "}
                      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#9ec0ff] hover:underline">
                        policies.google.com/privacy
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                    <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                    <span>
                      <strong className="text-[#F1F5FA]">Neon:</strong> Hosts our PostgreSQL database. View their privacy policy at{" "}
                      <a href="https://neon.tech/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#9ec0ff] hover:underline">
                        neon.tech/privacy-policy
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                    <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                    <span>
                      <strong className="text-[#F1F5FA]">Amazon Web Services (AWS S3):</strong> Stores uploaded listing images, documents, and media
                      assets used by the Platform. View their privacy policy at{" "}
                      <a href="https://aws.amazon.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-[#9ec0ff] hover:underline">
                        aws.amazon.com/privacy/
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                    <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                    <span>
                      <strong className="text-[#F1F5FA]">Brevo:</strong> Sends transactional and marketing email communications on our behalf. View
                      their privacy policy at{" "}
                      <a href="https://www.brevo.com/legal/privacypolicy/" target="_blank" rel="noopener noreferrer" className="text-[#9ec0ff] hover:underline">
                        brevo.com/legal/privacypolicy/
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                    <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                    <span>
                      <strong className="text-[#F1F5FA]">Google Analytics:</strong> Helps us understand site usage, traffic, and product performance.
                      View their privacy policy at{" "}
                      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#9ec0ff] hover:underline">
                        policies.google.com/privacy
                      </a>
                    </span>
                  </li>
                </ul>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">4.3 For Legal Reasons</h3>
                <p className="leading-relaxed text-[#E8EDF4]">We may disclose your information if required by law or to:</p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    "Comply with legal processes or government requests",
                    "Enforce our Terms of Service and other agreements",
                    "Protect the rights, property, or safety of Ready Set Fly, our users, or others",
                    "Prevent fraud or security threats",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">4.4 Business Transfers</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  If Ready Set Fly is involved in a merger, acquisition, financing, or sale of assets, your information may
                  be transferred as part of that transaction. We will notify you via email and/or prominent notice on the
                  Platform of any material change in ownership or use of your information.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">5. Data Retention</h2>
                <p className="leading-relaxed text-[#E8EDF4]">
                  We retain your information for as long as your account is active or as needed to provide you services. We
                  will retain and use your information as necessary to:
                </p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    "Comply with legal obligations, including tax, payment, and business record obligations",
                    "Resolve disputes and enforce our agreements",
                    "Prevent fraud and maintain platform security",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 leading-relaxed text-[#E8EDF4]">
                  When you request account deletion, we will delete your personal information within 30 days, except for
                  information we are required to retain for legal, regulatory, tax, payment, dispute-resolution, or
                  security purposes.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">6. Your Rights and Choices</h2>
                <p className="leading-relaxed text-[#E8EDF4]">You have the following rights regarding your information:</p>

                <h3 className="mb-2 mt-5 text-lg font-semibold text-[#F1F5FA]">6.1 Access and Update</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  You can access and update your account information at any time by logging into your account and visiting
                  your profile or account settings.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">6.2 Account Deletion</h3>
                <p className="leading-relaxed text-[#E8EDF4]">You have the right to request deletion of your account and personal data. You can:</p>
                <ul className="mt-3 space-y-2 pl-5">
                  <li className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                    <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                    <span>Delete your account from within the app by visiting Settings → Account → Delete Account</span>
                  </li>
                  <li className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                    <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                    <span>
                      Submit a deletion request at{" "}
                      <a href="/delete-account" className="text-[#9ec0ff] hover:underline">
                        readysetfly.us/delete-account
                      </a>
                    </span>
                  </li>
                </ul>
                <p className="mt-4 leading-relaxed text-[#E8EDF4]">
                  When you delete your account, we will remove personal information, messages, verification documents, and
                  user-generated records within a reasonable period, subject to required legal retention.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">6.3 Marketing Communications</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  You can opt out of marketing communications by following the unsubscribe link in our emails. You will
                  continue to receive transactional emails related to your account, rentals, listings, subscriptions, and
                  platform operations.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">6.4 Data Portability</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  You may request a copy of your personal data in a portable format by contacting{" "}
                  <a href="mailto:support@readysetfly.us" className="text-[#9ec0ff] hover:underline">
                    support@readysetfly.us
                  </a>
                  .
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">7. Data Security</h2>
                <p className="leading-relaxed text-[#E8EDF4]">We implement appropriate technical and organizational security measures to protect your information, including:</p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    "Encryption of data in transit using SSL/TLS",
                    "Secure password hashing using bcrypt",
                    "Secure token-based authentication for mobile and API flows where applicable",
                    "Regular security updates and operational monitoring",
                    "Limited access to personal data by authorized personnel only",
                    "Third-party payment processing so Ready Set Fly does not store full payment card numbers",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 leading-relaxed text-[#E8EDF4]">
                  However, no method of transmission over the internet or electronic storage is 100% secure. While we
                  strive to protect your information, we cannot guarantee absolute security.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">8. Children&apos;s Privacy</h2>
                <p className="leading-relaxed text-[#E8EDF4]">
                  The Platform is not intended for users under the age of 18. We do not knowingly collect personal
                  information from children under 18. If you are a parent or guardian and believe your child has provided
                  us with personal information, please contact{" "}
                  <a href="mailto:support@readysetfly.us" className="text-[#9ec0ff] hover:underline">
                    support@readysetfly.us
                  </a>
                  , and we will take appropriate action.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">9. Geographic Restrictions</h2>
                <p className="leading-relaxed text-[#E8EDF4]">
                  <strong className="text-[#F1F5FA]">Ready Set Fly is available exclusively to residents of the United States.</strong> The Platform is
                  not intended for use by individuals located outside the United States. By using the Platform, you
                  represent and warrant that you are a resident of the United States.
                </p>
                <p className="mt-4 leading-relaxed text-[#E8EDF4]">
                  All data is stored and processed on servers located in the United States. We comply with applicable US
                  federal and state privacy laws, including the California Consumer Privacy Act and California Privacy
                  Rights Act (CCPA/CPRA), together with other state-specific privacy laws where applicable.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">10. Changes to This Privacy Policy</h2>
                <p className="leading-relaxed text-[#E8EDF4]">We may update this Privacy Policy from time to time. We will notify you of any changes by:</p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    "Posting the new Privacy Policy on this page",
                    'Updating the "Last Updated" date at the top',
                    "Sending you an email notification for material changes when required",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 leading-relaxed text-[#E8EDF4]">
                  Your continued use of the Platform after changes are posted constitutes your acceptance of the updated
                  Privacy Policy.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">11. Contact Us</h2>
                <p className="leading-relaxed text-[#E8EDF4]">If you have any questions about this Privacy Policy or our privacy practices, please contact us:</p>
                <div className="rsf-metal-subpanel mt-4 rounded-[1rem] p-5">
                  <p className="text-sm text-[#E8EDF4]">
                    <span className="font-semibold text-[#F1F5FA]">Email:</span>{" "}
                    <a href="mailto:support@readysetfly.us" className="text-[#9ec0ff] hover:underline">support@readysetfly.us</a>
                  </p>
                  <p className="mt-2 text-sm text-[#E8EDF4]">
                    <span className="font-semibold text-[#F1F5FA]">Website:</span>{" "}
                    <a href="https://readysetfly.us" className="text-[#9ec0ff] hover:underline">readysetfly.us</a>
                  </p>
                  <p className="mt-2 text-sm text-[#E8EDF4]">
                    <span className="font-semibold text-[#F1F5FA]">Mail:</span>{" "}
                    <span className="text-[#91a8c3]">Ready Set Fly, LLC (Address to be provided)</span>
                  </p>
                </div>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">12. State-Specific Rights</h2>
                <h3 className="mb-2 mt-5 text-lg font-semibold text-[#F1F5FA]">California Residents</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  If you are a California resident, you may have additional rights under California privacy law, including:
                </p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    "Right to know what personal information is collected, used, shared, or disclosed",
                    "Right to request deletion of personal information, subject to exceptions",
                    "Right to correct inaccurate personal information",
                    "Right to opt out of certain data sharing or sale activities, where applicable",
                    "Right to non-discrimination for exercising privacy rights",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 leading-relaxed text-[#E8EDF4]">
                  To exercise any applicable privacy rights, contact{" "}
                  <a href="mailto:support@readysetfly.us" className="text-[#9ec0ff] hover:underline">
                    support@readysetfly.us
                  </a>
                  .
                </p>
                <p className="mt-4 leading-relaxed text-[#E8EDF4]">
                  Ready Set Fly does not sell personal information for money. We may use service providers for analytics,
                  communications, payments, hosting, and storage as described in this policy.
                </p>
              </section>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
