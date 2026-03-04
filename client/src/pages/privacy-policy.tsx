import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function PrivacyPolicy() {
  return (
    <div className="container max-w-4xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Privacy Policy</CardTitle>
          <CardDescription>Last Updated: March 4, 2026</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none space-y-6">
          <section>
            <h2 className="mb-3 text-xl font-semibold">1. Introduction</h2>
            <p>
              Ready Set Fly (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use
              our marketplace-first aviation platform, including listings, rentals, flight-planning tools, digital
              logbook features, training tools, our website at{" "}
              <a href="https://readysetfly.us" className="text-primary hover:underline">
                readysetfly.us
              </a>
              , and our mobile application (collectively, the &quot;Platform&quot;).
            </p>
            <p>
              By using the Platform, you agree to the collection and use of information in accordance with this Privacy
              Policy. If you do not agree with our policies and practices, please do not use the Platform.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="mb-3 text-xl font-semibold">2. Information We Collect</h2>

            <h3 className="mb-2 mt-4 text-lg font-semibold">2.1 Information You Provide to Us</h3>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Account Information:</strong> When you create an account, we collect your name, email address,
                and password if you use email/password authentication.
              </li>
              <li>
                <strong>Profile Information:</strong> We collect additional information you provide such as phone
                number, profile photo, bio, and role-related profile details.
              </li>
              <li>
                <strong>Verification Documents:</strong> To verify your identity as a pilot, instructor, aircraft
                owner, or service provider, we may collect pilot licenses, certificates, insurance documents, and other
                verification materials.
              </li>
              <li>
                <strong>Aircraft Information:</strong> If you list an aircraft, use aircraft profile features, or save
                aircraft assumptions for planning or ownership calculations, we collect registration numbers, make,
                model, specifications, photos, availability, and profile assumptions you provide.
              </li>
              <li>
                <strong>Marketplace and Directory Listings:</strong> If you create marketplace, rental, banner, or
                directory listings, we collect listing descriptions, pricing, media, contact details, and related
                business information.
              </li>
              <li>
                <strong>Flight Planning, Training, and Logbook Data:</strong> If you use planning, digital logbook, or
                training features, we collect the information you enter, such as saved flight plans, aircraft profiles,
                filing-preparation details, training progress, endorsements, lesson records, and logbook entries.
              </li>
              <li>
                <strong>Payment Information:</strong> We collect payment information necessary to process marketplace,
                rental, advertising, or subscription transactions, including payment method details processed by our
                payment processor, PayPal Business/Commerce.
              </li>
              <li>
                <strong>Messages and Support Requests:</strong> We collect and store messages you send through our
                platform messaging system, contact forms, or support channels.
              </li>
            </ul>

            <h3 className="mb-2 mt-4 text-lg font-semibold">2.2 Information Automatically Collected</h3>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Usage Data:</strong> We collect information about your interactions with the Platform,
                including pages visited, features used, search actions, clicks, and time spent on the Platform.
              </li>
              <li>
                <strong>Device Information:</strong> We collect information about your device, including device type,
                operating system, browser type, and IP address.
              </li>
              <li>
                <strong>Authentication Data:</strong> When you use third-party authentication such as Google Sign-In,
                we receive your name, email, and profile information from those services.
              </li>
              <li>
                <strong>Analytics and Diagnostic Data:</strong> We collect operational and analytics data such as
                referral pages, banner interactions, search patterns, feature usage, and error diagnostics to improve
                platform performance, reliability, and security.
              </li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="mb-3 text-xl font-semibold">3. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>To create and manage your account</li>
              <li>To verify your identity and qualifications where verification is offered</li>
              <li>To facilitate listings, rentals, subscriptions, advertising, and other marketplace transactions</li>
              <li>To process payments and manage financial transactions</li>
              <li>To enable communication between users through our messaging system and listing inquiry forms</li>
              <li>To save and synchronize planning, training, and logbook workflows across your account</li>
              <li>To provide customer support and respond to your inquiries</li>
              <li>To send important notifications about your account, rentals, listings, subscriptions, and transactions</li>
              <li>To send marketing emails and product announcements when you have opted in</li>
              <li>To prevent fraud, enforce our Terms of Service, and ensure platform security</li>
              <li>To improve and optimize the Platform based on usage patterns</li>
              <li>To comply with legal obligations and regulatory requirements</li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="mb-3 text-xl font-semibold">4. How We Share Your Information</h2>
            <p>We may share your information in the following circumstances:</p>

            <h3 className="mb-2 mt-4 text-lg font-semibold">4.1 With Other Users</h3>
            <p>
              When you create listings, directory profiles, or submit rental or marketplace inquiries, certain
              information such as your name, profile photo, listing details, and contact details may be visible to
              other users as needed to facilitate that interaction.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-semibold">4.2 With Service Providers</h3>
            <p>We share information with third-party service providers who assist us in operating the Platform:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>PayPal Business/Commerce:</strong> Processes payments for rentals, listings, subscriptions, and
                advertising. View their privacy policy at{" "}
                <a
                  href="https://www.paypal.com/us/legalhub/privacy-full"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  paypal.com/us/legalhub/privacy-full
                </a>
              </li>
              <li>
                <strong>Google Identity:</strong> Provides authentication services when you sign in using Google. View
                their privacy policy at{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  policies.google.com/privacy
                </a>
              </li>
              <li>
                <strong>Neon:</strong> Hosts our PostgreSQL database. View their privacy policy at{" "}
                <a
                  href="https://neon.tech/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  neon.tech/privacy-policy
                </a>
              </li>
              <li>
                <strong>Amazon Web Services (AWS S3):</strong> Stores uploaded listing images, documents, and media
                assets used by the Platform. View their privacy policy at{" "}
                <a
                  href="https://aws.amazon.com/privacy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  aws.amazon.com/privacy/
                </a>
              </li>
              <li>
                <strong>Brevo:</strong> Sends transactional and marketing email communications on our behalf. View
                their privacy policy at{" "}
                <a
                  href="https://www.brevo.com/legal/privacypolicy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  brevo.com/legal/privacypolicy/
                </a>
              </li>
              <li>
                <strong>Google Analytics:</strong> Helps us understand site usage, traffic, and product performance.
                View their privacy policy at{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  policies.google.com/privacy
                </a>
              </li>
            </ul>

            <h3 className="mb-2 mt-4 text-lg font-semibold">4.3 For Legal Reasons</h3>
            <p>We may disclose your information if required by law or to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Comply with legal processes or government requests</li>
              <li>Enforce our Terms of Service and other agreements</li>
              <li>Protect the rights, property, or safety of Ready Set Fly, our users, or others</li>
              <li>Prevent fraud or security threats</li>
            </ul>

            <h3 className="mb-2 mt-4 text-lg font-semibold">4.4 Business Transfers</h3>
            <p>
              If Ready Set Fly is involved in a merger, acquisition, financing, or sale of assets, your information may
              be transferred as part of that transaction. We will notify you via email and/or prominent notice on the
              Platform of any material change in ownership or use of your information.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="mb-3 text-xl font-semibold">5. Data Retention</h2>
            <p>
              We retain your information for as long as your account is active or as needed to provide you services. We
              will retain and use your information as necessary to:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Comply with legal obligations, including tax, payment, and business record obligations</li>
              <li>Resolve disputes and enforce our agreements</li>
              <li>Prevent fraud and maintain platform security</li>
            </ul>
            <p className="mt-3">
              When you request account deletion, we will delete your personal information within 30 days, except for
              information we are required to retain for legal, regulatory, tax, payment, dispute-resolution, or
              security purposes.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="mb-3 text-xl font-semibold">6. Your Rights and Choices</h2>
            <p>You have the following rights regarding your information:</p>

            <h3 className="mb-2 mt-4 text-lg font-semibold">6.1 Access and Update</h3>
            <p>
              You can access and update your account information at any time by logging into your account and visiting
              your profile or account settings.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-semibold">6.2 Account Deletion</h3>
            <p>You have the right to request deletion of your account and personal data. You can:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Delete your account from within the app by visiting Settings -&gt; Account -&gt; Delete Account</li>
              <li>
                Submit a deletion request at{" "}
                <a href="/delete-account" className="text-primary hover:underline">
                  readysetfly.us/delete-account
                </a>
              </li>
            </ul>
            <p className="mt-3">
              When you delete your account, we will remove personal information, messages, verification documents, and
              user-generated records within a reasonable period, subject to required legal retention.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-semibold">6.3 Marketing Communications</h3>
            <p>
              You can opt out of marketing communications by following the unsubscribe link in our emails. You will
              continue to receive transactional emails related to your account, rentals, listings, subscriptions, and
              platform operations.
            </p>

            <h3 className="mb-2 mt-4 text-lg font-semibold">6.4 Data Portability</h3>
            <p>
              You may request a copy of your personal data in a portable format by contacting{" "}
              <a href="mailto:support@readysetfly.us" className="text-primary hover:underline">
                support@readysetfly.us
              </a>
              .
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="mb-3 text-xl font-semibold">7. Data Security</h2>
            <p>We implement appropriate technical and organizational security measures to protect your information, including:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Encryption of data in transit using SSL/TLS</li>
              <li>Secure password hashing using bcrypt</li>
              <li>Secure token-based authentication for mobile and API flows where applicable</li>
              <li>Regular security updates and operational monitoring</li>
              <li>Limited access to personal data by authorized personnel only</li>
              <li>Third-party payment processing so Ready Set Fly does not store full payment card numbers</li>
            </ul>
            <p className="mt-3">
              However, no method of transmission over the internet or electronic storage is 100% secure. While we
              strive to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="mb-3 text-xl font-semibold">8. Children&apos;s Privacy</h2>
            <p>
              The Platform is not intended for users under the age of 18. We do not knowingly collect personal
              information from children under 18. If you are a parent or guardian and believe your child has provided
              us with personal information, please contact{" "}
              <a href="mailto:support@readysetfly.us" className="text-primary hover:underline">
                support@readysetfly.us
              </a>
              , and we will take appropriate action.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="mb-3 text-xl font-semibold">9. Geographic Restrictions</h2>
            <p>
              <strong>Ready Set Fly is available exclusively to residents of the United States.</strong> The Platform is
              not intended for use by individuals located outside the United States. By using the Platform, you
              represent and warrant that you are a resident of the United States.
            </p>
            <p className="mt-3">
              All data is stored and processed on servers located in the United States. We comply with applicable US
              federal and state privacy laws, including the California Consumer Privacy Act and California Privacy
              Rights Act (CCPA/CPRA), together with other state-specific privacy laws where applicable.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="mb-3 text-xl font-semibold">10. Changes to This Privacy Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of any changes by:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Posting the new Privacy Policy on this page</li>
              <li>Updating the &quot;Last Updated&quot; date at the top</li>
              <li>Sending you an email notification for material changes when required</li>
            </ul>
            <p className="mt-3">
              Your continued use of the Platform after changes are posted constitutes your acceptance of the updated
              Privacy Policy.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="mb-3 text-xl font-semibold">11. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy or our privacy practices, please contact us:</p>
            <div className="mt-3 rounded-md bg-muted p-4">
              <p>
                <strong>Email:</strong> support@readysetfly.us
              </p>
              <p>
                <strong>Website:</strong>{" "}
                <a href="https://readysetfly.us" className="text-primary hover:underline">
                  readysetfly.us
                </a>
              </p>
              <p>
                <strong>Mail:</strong> Ready Set Fly, LLC (Address to be provided)
              </p>
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="mb-3 text-xl font-semibold">12. State-Specific Rights</h2>
            <h3 className="mb-2 mt-4 text-lg font-semibold">California Residents</h3>
            <p>
              If you are a California resident, you may have additional rights under California privacy law,
              including:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Right to know what personal information is collected, used, shared, or disclosed</li>
              <li>Right to request deletion of personal information, subject to exceptions</li>
              <li>Right to correct inaccurate personal information</li>
              <li>Right to opt out of certain data sharing or sale activities, where applicable</li>
              <li>Right to non-discrimination for exercising privacy rights</li>
            </ul>
            <p className="mt-3">
              To exercise any applicable privacy rights, contact{" "}
              <a href="mailto:support@readysetfly.us" className="text-primary hover:underline">
                support@readysetfly.us
              </a>
              .
            </p>
            <p className="mt-3">
              Ready Set Fly does not sell personal information for money. We may use service providers for analytics,
              communications, payments, hosting, and storage as described in this policy.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
