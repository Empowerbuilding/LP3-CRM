import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy - LP3 Roofing',
  description: 'Privacy Policy for LP3 Roofing CRM',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link
          href="/"
          className="text-sm text-brand-600 hover:text-brand-800 mb-8 inline-block"
        >
          &larr; Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>

        <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 space-y-6 text-gray-700">
          <p className="text-sm text-gray-500">Last updated: January 2025</p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Company Information</h2>
            <p>
              This Privacy Policy applies to the services provided by <strong>LP3 Roofing</strong>.
            </p>
            <p className="mt-2">
              Contact Email: <a href="mailto:info@lp3rc.com" className="text-brand-600 hover:underline">info@lp3rc.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Contact Information:</strong> Name, email address, phone number</li>
              <li><strong>Business Information:</strong> Company name, role, project details</li>
              <li><strong>Facebook Lead Ad Data:</strong> Information submitted through Facebook Lead Ads forms, including name, email, phone number, and any custom questions</li>
              <li><strong>Usage Data:</strong> Information about how you interact with our services</li>
              <li><strong>Communication Records:</strong> Records of emails, calls, and meetings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Manage customer relationships and provide our services</li>
              <li>Process and respond to inquiries from lead generation forms</li>
              <li>Schedule meetings and follow up on project opportunities</li>
              <li>Send relevant marketing communications (with your consent)</li>
              <li>Improve our services and customer experience</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Facebook Lead Ads Integration</h2>
            <p>
              We receive lead information from Facebook Lead Ads. When you submit a form through our Facebook Lead Ads, the information you provide (such as your name, email, and phone number) is transmitted to our CRM system for lead management purposes.
            </p>
            <p className="mt-2">
              This data is used solely to respond to your inquiry and provide you with information about our construction and design services. We do not sell or share this information with third parties for their marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Facebook Conversions API</h2>
            <p>
              We use Facebook Conversions API to send event data to Facebook for advertising measurement and optimization. This helps us understand the effectiveness of our Facebook ads and provide you with more relevant advertising. The data sent includes hashed customer information (email, phone) for matching purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to fulfill the purposes outlined in this policy, unless a longer retention period is required or permitted by law. For lead and customer data, we typically retain information for the duration of our business relationship plus an additional period as required for legal, accounting, or reporting purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption of data in transit and at rest, access controls, and regular security assessments.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your personal information</li>
              <li>Object to processing of your information</li>
              <li>Request data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Deletion Requests</h2>
            <p>
              To request deletion of your personal data, please contact us at{' '}
              <a href="mailto:info@lp3rc.com" className="text-brand-600 hover:underline">
                info@lp3rc.com
              </a>{' '}
              with the subject line &quot;Data Deletion Request&quot;. Please include your name and email address so we can locate your records.
            </p>
            <p className="mt-2">
              We will process your request within 30 days and confirm once your data has been deleted from our systems.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><strong>Facebook/Meta:</strong> Lead Ads and Conversions API for advertising</li>
              <li><strong>Google:</strong> Calendar integration for scheduling</li>
              <li><strong>Supabase:</strong> Database and authentication services</li>
            </ul>
            <p className="mt-2">
              Each of these services has their own privacy policies governing their use of data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="mt-2">
              <strong>LP3 Roofing</strong><br />
              Email: <a href="mailto:info@lp3rc.com" className="text-brand-600 hover:underline">info@lp3rc.com</a>
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
