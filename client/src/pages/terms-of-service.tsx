import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function TermsOfService() {
  return (
    <div className="container max-w-4xl py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Terms of Service</CardTitle>
          <CardDescription>Last Updated: November 8, 2024</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 prose prose-sm max-w-none">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Agreement to Terms</h2>
            <p>
              Welcome to Ready Set Fly. These Terms of Service ("Terms") govern your access to and use of our 
              aviation marketplace and rental platform, including our website at readysetfly.us and our mobile 
              application (collectively, the "Platform").
            </p>
            <p>
              By accessing or using the Platform, you agree to be bound by these Terms and our Privacy Policy. 
              If you do not agree to these Terms, you may not access or use the Platform.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Eligibility</h2>
            <p>You must meet the following requirements to use the Platform:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>You must be a resident of the United States</strong></li>
              <li>You must be at least 18 years old</li>
              <li>You must have the legal capacity to enter into binding contracts</li>
              <li>You must not be prohibited from using the Platform under applicable laws</li>
              <li>
                To rent aircraft or list aircraft for rent, you must hold valid pilot certificates and/or 
                aircraft ownership documentation as required by law
              </li>
            </ul>
            <p className="mt-3">
              Ready Set Fly is exclusively available to United States residents. By using the Platform, you 
              represent and warrant that you are located in and are a resident of the United States.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Account Registration and Security</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">3.1 Account Creation</h3>
            <p>
              To use certain features of the Platform, you must create an account. You agree to provide accurate, 
              current, and complete information during registration and to update such information to keep it 
              accurate, current, and complete.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">3.2 Account Security</h3>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all 
              activities that occur under your account. You agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use a strong, unique password</li>
              <li>Not share your password with others</li>
              <li>Immediately notify us of any unauthorized use of your account</li>
              <li>Take reasonable precautions to prevent unauthorized access</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">3.3 Account Verification</h3>
            <p>
              We may require you to verify your identity by providing pilot certificates, aircraft ownership 
              documents, insurance information, or other documentation. Failure to provide requested verification 
              may result in account suspension or limitations on Platform features.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Platform Services</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">4.1 Aircraft Rentals</h3>
            <p>
              Ready Set Fly provides a platform connecting aircraft owners with pilots seeking to rent aircraft. 
              We are not a party to rental agreements between owners and renters. All rental agreements are 
              directly between the owner and renter.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">4.2 Marketplace</h3>
            <p>
              Our marketplace allows users to list and browse various aviation-related items and services, 
              including aircraft for sale, CFI services, job postings, flight schools, mechanics, and charter 
              services. We do not guarantee the accuracy, quality, safety, or legality of any marketplace listings.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">4.3 Messaging</h3>
            <p>
              The Platform provides messaging functionality to facilitate communication between users. You agree 
              to use messaging only for legitimate Platform-related purposes and not for spam, harassment, or 
              illegal activities.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Fees and Payments</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">5.1 Platform Fees for Aircraft Rentals</h3>
            <p>
              Ready Set Fly charges the following fees for aircraft rental transactions:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Renter Booking Fee:</strong> 7.5% of the total rental amount</li>
              <li><strong>Owner Commission:</strong> 7.5% deducted from owner payout</li>
              <li><strong>Sales Tax:</strong> 8.25% on all rental amounts and booking fees</li>
              <li><strong>Credit Card Processing Fee:</strong> 3% to cover payment processing costs</li>
            </ul>
            <p className="mt-3">
              <strong>Example:</strong> For a $1,000 rental, the renter pays $1,000 (base rental) + $75 (7.5% booking fee) + 
              $88.69 (8.25% sales tax on $1,075) + $34.91 (3% CC processing fee) = <strong>$1,198.60 total</strong>. 
              The owner receives $925 after the 7.5% platform commission is deducted.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">5.2 Marketplace Listing Fees</h3>
            <p>
              Marketplace listings require a monthly subscription fee based on the listing category and tier. 
              All prices include 8.25% sales tax:
            </p>
            <p className="mt-3"><strong>Aircraft for Sale</strong> (3 tier options):</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Basic Tier:</strong> $25/month + tax = $27.06/month</li>
              <li><strong>Standard Tier:</strong> $40/month + tax = $43.30/month</li>
              <li><strong>Premium Tier:</strong> $100/month + tax = $108.25/month</li>
            </ul>
            <p className="mt-3"><strong>Other Categories</strong> (fixed monthly fees):</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>CFI Listings:</strong> $30/month + tax = $32.48/month</li>
              <li><strong>Job Postings:</strong> $40/month + tax = $43.30/month</li>
              <li><strong>Flight School Listings:</strong> $250/month + tax = $270.63/month</li>
              <li><strong>Mechanic Services:</strong> $40/month + tax = $43.30/month</li>
              <li><strong>Charter Services:</strong> $250/month + tax = $270.63/month</li>
            </ul>
            <p className="mt-3">
              Listings are automatically renewed monthly unless you cancel your subscription. You are responsible 
              for canceling before the renewal date to avoid being charged for the next billing period. Promotional 
              codes may be available for limited-time free trials or discounts.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">5.3 Payment Processing</h3>
            <p>
              All payments are processed through PayPal, our exclusive payment processor. You agree to comply 
              with PayPal's terms of service. We do not store your complete payment card information. Only credit 
              card payments are accepted (Pay Later options are disabled for compliance and security).
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">5.4 Owner Withdrawals</h3>
            <p>
              Aircraft owners can request withdrawals of their rental earnings via PayPal. Withdrawals are 
              processed using the PayPal Payouts API and are typically completed within 1-3 business days. 
              Minimum withdrawal amount may apply.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">5.5 Refunds</h3>
            <p>
              Refund eligibility is determined by the specific circumstances of each transaction:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Rental Refunds:</strong> Subject to the cancellation policy agreed upon between owner 
                and renter. <strong>No refunds will be issued for weather-related cancellations.</strong> Ready Set Fly 
                is not responsible for weather or weather-related cancellations. Platform fees are non-refundable under 
                all circumstances.
              </li>
              <li>
                <strong>Marketplace Listing Fees:</strong> Non-refundable. You may cancel at any time to prevent 
                future charges.
              </li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">5.6 Fee Changes</h3>
            <p>
              We reserve the right to change our fees at any time. We will provide at least 30 days' notice of 
              fee increases by email and/or prominent notice on the Platform. Your continued use of the Platform 
              after fee changes take effect constitutes acceptance of the new fees.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">6. User Responsibilities</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">6.1 Aircraft Owners</h3>
            <p>If you list aircraft for rent, you represent and warrant that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You have legal authority to rent the aircraft</li>
              <li>The aircraft is airworthy and properly maintained</li>
              <li>You carry adequate insurance coverage</li>
              <li>All required certificates and documentation are current and valid</li>
              <li>Your listing information is accurate and complete</li>
              <li>You will comply with all applicable aviation regulations and laws</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">6.2 Renters</h3>
            <p>If you rent aircraft, you represent and warrant that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You hold all required pilot certificates and ratings</li>
              <li>Your certificates and medical are current and valid</li>
              <li>You are legally permitted to operate the aircraft</li>
              <li>You will comply with all applicable aviation regulations and laws</li>
              <li>You will operate the aircraft safely and responsibly</li>
              <li>You will pay all rental fees and charges on time</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">6.3 All Users</h3>
            <p>All users agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate and truthful information</li>
              <li>Not impersonate others or misrepresent your identity</li>
              <li>Not engage in fraudulent, deceptive, or illegal activities</li>
              <li>Not harass, threaten, or abuse other users</li>
              <li>Not violate the intellectual property rights of others</li>
              <li>Comply with all applicable laws and regulations</li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Prohibited Conduct</h2>
            <p>You may not:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the Platform for any illegal purpose</li>
              <li>Violate any local, state, national, or international law</li>
              <li>Interfere with or disrupt the Platform or servers</li>
              <li>Attempt to gain unauthorized access to the Platform or other user accounts</li>
              <li>Transmit viruses, malware, or other harmful code</li>
              <li>Collect or harvest user information without consent</li>
              <li>Use automated systems (bots, scrapers) to access the Platform</li>
              <li>Circumvent security features or access controls</li>
              <li>Post false, misleading, or fraudulent content</li>
              <li>Engage in price manipulation or other anti-competitive behavior</li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Content and Intellectual Property</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">8.1 Your Content</h3>
            <p>
              You retain ownership of all content you post on the Platform (listings, photos, messages, etc.). 
              By posting content, you grant Ready Set Fly a worldwide, non-exclusive, royalty-free license to 
              use, reproduce, modify, display, and distribute your content in connection with operating and 
              promoting the Platform.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">8.2 Our Content</h3>
            <p>
              The Platform and all content, features, and functionality (including but not limited to design, 
              text, graphics, logos, and software) are owned by Ready Set Fly and are protected by copyright, 
              trademark, and other intellectual property laws.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">8.3 Copyright Infringement</h3>
            <p>
              We respect intellectual property rights. If you believe your copyright has been infringed, please 
              contact us at legal@readysetfly.us with details of the alleged infringement.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Disclaimers and Limitation of Liability</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">9.1 Platform Provided "As Is"</h3>
            <p>
              THE PLATFORM IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, 
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, 
              FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">9.2 No Guarantee of Service</h3>
            <p>
              We do not guarantee that the Platform will be uninterrupted, secure, or error-free. We do not 
              guarantee the accuracy, completeness, or reliability of any content on the Platform.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">9.3 Third-Party Transactions</h3>
            <p>
              Ready Set Fly is not a party to any rental agreements or marketplace transactions between users. 
              We do not verify the accuracy of listings, the qualifications of users, or the airworthiness of 
              aircraft. You are solely responsible for evaluating and verifying all aspects of any transaction 
              you enter into through the Platform.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">9.4 Aviation Risks</h3>
            <p>
              Aviation involves inherent risks. Ready Set Fly is not responsible for any accidents, injuries, 
              damages, or losses resulting from aircraft rentals or operations. You assume all risks associated 
              with aviation activities.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">9.5 Limitation of Liability</h3>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, READY SET FLY, ITS OFFICERS, DIRECTORS, EMPLOYEES, AND 
              AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE 
              DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR 
              RELATED TO YOUR USE OF THE PLATFORM, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="mt-3">
              IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS EXCEED THE GREATER OF $100 OR THE 
              AMOUNT YOU PAID TO US IN FEES IN THE 12 MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Ready Set Fly, its officers, directors, employees, 
              and agents from and against any claims, liabilities, damages, losses, and expenses (including 
              reasonable attorneys' fees) arising out of or related to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your use of the Platform</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any law or regulation</li>
              <li>Your violation of the rights of any third party</li>
              <li>Any content you post on the Platform</li>
              <li>Any aircraft rental or marketplace transaction you enter into</li>
            </ul>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Dispute Resolution</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">11.1 Informal Resolution</h3>
            <p>
              If you have a dispute with Ready Set Fly, you agree to first contact us at coryarmer@gmail.com 
              to attempt to resolve the dispute informally.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">11.2 Arbitration</h3>
            <p>
              Any dispute that cannot be resolved informally shall be resolved by binding arbitration in accordance 
              with the rules of the American Arbitration Association. The arbitration shall take place in Texas.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">11.3 Class Action Waiver</h3>
            <p>
              You agree that any arbitration or proceeding shall be limited to the dispute between you and Ready 
              Set Fly individually. You waive the right to participate in any class action or class-wide arbitration.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">11.4 Governing Law</h3>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of Texas, without 
              regard to its conflict of law provisions.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Account Termination</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">12.1 Termination by You</h3>
            <p>
              You may delete your account at any time by visiting your account settings or by contacting us at 
              coryarmer@gmail.com. You can also submit a deletion request at 
              <a href="/delete-account" className="text-primary hover:underline"> readysetfly.us/delete-account</a>.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">12.2 Termination by Us</h3>
            <p>
              We reserve the right to suspend or terminate your account at any time, with or without notice, for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Violation of these Terms</li>
              <li>Fraudulent, deceptive, or illegal activity</li>
              <li>Failure to verify your identity when requested</li>
              <li>Outstanding payment obligations</li>
              <li>Any reason at our sole discretion</li>
            </ul>

            <h3 className="text-lg font-semibold mt-4 mb-2">12.3 Effect of Termination</h3>
            <p>
              Upon termination, your right to use the Platform will immediately cease. We may delete your account 
              data in accordance with our Privacy Policy. Outstanding payment obligations will survive termination.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Modifications to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of material changes by:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Posting the updated Terms on this page</li>
              <li>Updating the "Last Updated" date</li>
              <li>Sending you an email notification</li>
            </ul>
            <p className="mt-3">
              Your continued use of the Platform after the effective date of the revised Terms constitutes your 
              acceptance of the changes. If you do not agree to the revised Terms, you must stop using the Platform.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">14. General Provisions</h2>
            
            <h3 className="text-lg font-semibold mt-4 mb-2">14.1 Entire Agreement</h3>
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and 
              Ready Set Fly regarding the Platform.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">14.2 Severability</h3>
            <p>
              If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions 
              will remain in full force and effect.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">14.3 Waiver</h3>
            <p>
              Our failure to enforce any right or provision of these Terms will not be deemed a waiver of such 
              right or provision.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">14.4 Assignment</h3>
            <p>
              You may not assign or transfer these Terms or your account without our prior written consent. We 
              may assign these Terms without restriction.
            </p>

            <h3 className="text-lg font-semibold mt-4 mb-2">14.5 Force Majeure</h3>
            <p>
              We shall not be liable for any failure or delay in performance due to circumstances beyond our 
              reasonable control, including but not limited to acts of God, war, terrorism, natural disasters, 
              or government actions.
            </p>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold mb-3">15. Contact Information</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="bg-muted p-4 rounded-md mt-3">
              <p><strong>Email:</strong> legal@readysetfly.us</p>
              <p><strong>Support:</strong> coryarmer@gmail.com</p>
              <p><strong>Website:</strong> <a href="https://readysetfly.us" className="text-primary hover:underline">readysetfly.us</a></p>
              <p><strong>Mail:</strong> Ready Set Fly, LLC (Address to be provided)</p>
            </div>
          </section>

          <Separator />

          <div className="bg-muted/50 p-4 rounded-md border">
            <p className="text-sm text-muted-foreground">
              <strong>Important Notice:</strong> These Terms of Service contain important information about your 
              legal rights and obligations, including limitations on liability and dispute resolution provisions. 
              Please read them carefully. By using the Platform, you acknowledge that you have read, understood, 
              and agree to be bound by these Terms.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

