import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function PrivacyPolicy() {
  return (
    <div className="container max-w-4xl py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Privacy Policy</CardTitle>
          <CardDescription>Last Updated: November 2, 2024</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 prose prose-sm max-w-none">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p>
              Ready Set Fly ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
              explains how we collect, use, disclose, and safeguard your information when you use our aviation 
              marketplace and rental platform, including our website at readysetfly.us and our mobile application 
              (collectively, the "Platform").
            </p>
            <p>
              By using the Platform, you agree to the collection and use of information in accordance with this 
              Privacy Policy. If you do not agree with our policies and practices, please do not use the Platform.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">2.1 Information You Provide to Us</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account Information:</strong> When you create an account, we collect your name, email address, 
                and password (if using email/password authentication).
              </li>
              <li>
                <strong>Profile Information:</strong> We collect additional information you provide such as phone number, 
                profile photo, and bio.
              </li>
              <li>
                <strong>Verification Documents:</strong> To verify your identity as a pilot or aircraft owner, we collect 
                pilot licenses, certificates, insurance documents, and other verification materials.
              </li>
              <li>
                <strong>Aircraft Information:</strong> If you list an aircraft for rent, we collect aircraft registration 
                numbers, make, model, specifications, photos, and availability information.
              </li>
              <li>
                <strong>Marketplace Listings:</strong> If you create marketplace listings, we collect listing descriptions, 
                photos, prices, and contact information.
              </li>
              <li>
                <strong>Payment Information:</strong> We collect payment information necessary to process rental payments 
                and marketplace transactions, including payment method details processed by our payment processor (PayPal Braintree).
              </li>
              <li>
                <strong>Messages:</strong> We collect and store messages you send through our platform messaging system.
              </li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">2.2 Information Automatically Collected</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Usage Data:</strong> We collect information about your interactions with the Platform, including 
                pages visited, features used, and time spent on the Platform.
              </li>
              <li>
                <strong>Device Information:</strong> We collect information about your device, including device type, 
                operating system, browser type, and IP address.
              </li>
              <li>
                <strong>Authentication Data:</strong> When you use third-party authentication (Google, GitHub via Replit Auth), 
                we receive your name, email, and profile information from those services.
              </li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>To create and manage your account</li>
              <li>To verify your identity as a pilot or aircraft owner</li>
              <li>To facilitate aircraft rentals and marketplace transactions</li>
              <li>To process payments and manage financial transactions</li>
              <li>To enable communication between users through our messaging system</li>
              <li>To provide customer support and respond to your inquiries</li>
              <li>To send important notifications about your account, rentals, and transactions</li>
              <li>To prevent fraud, enforce our Terms of Service, and ensure platform security</li>
              <li>To improve and optimize the Platform based on usage patterns</li>
              <li>To comply with legal obligations and regulatory requirements</li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">4. How We Share Your Information</h2>
            <p>We may share your information in the following circumstances:</p>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">4.1 With Other Users</h3>
            <p>
              When you list an aircraft or create a marketplace listing, certain information (name, profile photo, 
              listing details) is visible to other users. When you book a rental, your information is shared with 
              the aircraft owner to facilitate the rental.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">4.2 With Service Providers</h3>
            <p>We share information with third-party service providers who assist us in operating the Platform:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>PayPal Braintree:</strong> Processes payments for aircraft rentals and marketplace fees. 
                View their privacy policy at <a href="https://www.braintreepayments.com/legal/braintree-privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">braintreepayments.com/legal/braintree-privacy-policy</a>
              </li>
              <li>
                <strong>PayPal Payouts API:</strong> Processes owner withdrawals. 
                View their privacy policy at <a href="https://www.paypal.com/us/legalhub/privacy-full" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">paypal.com/us/legalhub/privacy-full</a>
              </li>
              <li>
                <strong>Replit:</strong> Provides authentication services and hosting infrastructure. 
                View their privacy policy at <a href="https://replit.com/site/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">replit.com/site/privacy</a>
              </li>
              <li>
                <strong>Neon (PostgreSQL Database):</strong> Hosts our database. 
                View their privacy policy at <a href="https://neon.tech/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">neon.tech/privacy-policy</a>
              </li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">4.3 For Legal Reasons</h3>
            <p>We may disclose your information if required by law or to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Comply with legal processes or government requests</li>
              <li>Enforce our Terms of Service and other agreements</li>
              <li>Protect the rights, property, or safety of Ready Set Fly, our users, or others</li>
              <li>Prevent fraud or security threats</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">4.4 Business Transfers</h3>
            <p>
              If Ready Set Fly is involved in a merger, acquisition, or sale of assets, your information may be 
              transferred as part of that transaction. We will notify you via email and/or prominent notice on 
              the Platform of any change in ownership or use of your information.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
            <p>
              We retain your information for as long as your account is active or as needed to provide you services. 
              We will retain and use your information as necessary to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Comply with legal obligations (e.g., tax records for 7 years)</li>
              <li>Resolve disputes and enforce our agreements</li>
              <li>Prevent fraud and maintain platform security</li>
            </ul>
            <p className="mt-3">
              When you request account deletion, we will delete your personal information within 30 days, except 
              for information we are required to retain for legal, regulatory, or security purposes.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Your Rights and Choices</h2>
            <p>You have the following rights regarding your information:</p>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">6.1 Access and Update</h3>
            <p>
              You can access and update your account information at any time by logging into your account and 
              visiting your Profile settings.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">6.2 Account Deletion</h3>
            <p>You have the right to request deletion of your account and personal data. You can:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Delete your account from within the app by visiting Settings → Account → Delete Account</li>
              <li>Submit a deletion request at <a href="/delete-account" className="text-primary hover:underline">readysetfly.us/delete-account</a></li>
            </ul>
            <p className="mt-3">
              When you delete your account, we will remove your personal information, rental history, messages, 
              and verification documents within 30 days. Some information may be retained as required by law.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">6.3 Marketing Communications</h3>
            <p>
              You can opt out of marketing communications by following the unsubscribe link in our emails. You will 
              continue to receive transactional emails related to your account and rentals.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">6.4 Data Portability</h3>
            <p>
              You have the right to request a copy of your personal data in a portable format. Contact us at 
              privacy@readysetfly.us to request your data.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Data Security</h2>
            <p>
              We implement appropriate technical and organizational security measures to protect your information, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encryption of data in transit using SSL/TLS</li>
              <li>Secure password hashing using bcrypt</li>
              <li>Secure token-based authentication (JWT for mobile apps)</li>
              <li>Regular security audits and updates</li>
              <li>Limited access to personal data by authorized personnel only</li>
            </ul>
            <p className="mt-3">
              However, no method of transmission over the internet or electronic storage is 100% secure. While we 
              strive to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Children's Privacy</h2>
            <p>
              The Platform is not intended for users under the age of 18. We do not knowingly collect personal 
              information from children under 18. If you are a parent or guardian and believe your child has 
              provided us with personal information, please contact us at privacy@readysetfly.us, and we will 
              delete such information.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">9. International Data Transfers</h2>
            <p>
              Your information may be transferred to and maintained on servers located outside of your state, 
              province, country, or other governmental jurisdiction. If you are located outside the United States 
              and choose to use the Platform, your information will be transferred to the United States and 
              processed there.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Posting the new Privacy Policy on this page</li>
              <li>Updating the "Last Updated" date at the top</li>
              <li>Sending you an email notification for material changes</li>
            </ul>
            <p className="mt-3">
              Your continued use of the Platform after changes are posted constitutes your acceptance of the 
              updated Privacy Policy.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our privacy practices, please contact us:
            </p>
            <div className="bg-muted p-4 rounded-md mt-3">
              <p><strong>Email:</strong> privacy@readysetfly.us</p>
              <p><strong>Website:</strong> <a href="https://readysetfly.us" className="text-primary hover:underline">readysetfly.us</a></p>
              <p><strong>Mail:</strong> Ready Set Fly, [Your Business Address]</p>
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">12. State-Specific Rights</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">California Residents (CCPA)</h3>
            <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Right to know what personal information is collected, used, shared, or sold</li>
              <li>Right to delete personal information</li>
              <li>Right to opt-out of the sale of personal information (we do not sell your information)</li>
              <li>Right to non-discrimination for exercising your CCPA rights</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">European Residents (GDPR)</h3>
            <p>If you are located in the European Economic Area (EEA), you have rights under the General Data Protection Regulation (GDPR):</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Right of access to your personal data</li>
              <li>Right to rectification of inaccurate data</li>
              <li>Right to erasure ("right to be forgotten")</li>
              <li>Right to restriction of processing</li>
              <li>Right to data portability</li>
              <li>Right to object to processing</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, please contact us at privacy@readysetfly.us.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
