import LegalPage, { H2, P, Ul } from '../../components/legal/LegalPage'

export default function SafeguardingPolicy() {
  return (
    <LegalPage title="Safeguarding Policy" updated="1st September 2026">
      <P className="text-xs text-gray-400 italic">
        Internal document — for HHF CareConnect staff and volunteers only.
      </P>

      <H2>1. Purpose</H2>
      <P>
        This policy sets out how HHF staff and volunteers must respond when a child, young person, or
        vulnerable adult discloses harm, abuse, or risk to themselves or others through HHF CareConnect.
        It exists to protect the people we serve and to guide staff in acting consistently, safely, and
        lawfully. This policy applies alongside our Terms of Use and Privacy Policy, and takes priority
        over normal confidentiality expectations where a person's safety is at risk.
      </P>

      <H2>2. Our Commitment</H2>
      <Ul>
        <li>Treating every disclosure of harm seriously and with compassion</li>
        <li>Never ignoring, dismissing, or promising to "keep secret" a disclosure involving risk of serious harm</li>
        <li>Acting in the best interest of the individual, especially where children or vulnerable adults are involved</li>
        <li>Supporting staff and volunteers to respond appropriately, without expecting them to act as counselors or investigators beyond their role</li>
      </Ul>

      <H2>3. Who This Applies To</H2>
      <Ul>
        <li><strong>Children:</strong> anyone under 18 years old</li>
        <li><strong>Vulnerable adults:</strong> anyone who, due to their circumstances (illness, disability, crisis, dependency, etc.), may be less able to protect themselves from harm or exploitation</li>
      </Ul>

      <H2>4. Recognizing a Safeguarding Concern</H2>
      <P>A safeguarding concern may arise when someone using HHF CareConnect discloses or shows signs of:</P>
      <Ul>
        <li>Physical, emotional, or sexual abuse</li>
        <li>Neglect</li>
        <li>Domestic violence</li>
        <li>Self-harm or suicidal thoughts</li>
        <li>Exploitation or trafficking</li>
        <li>Being in immediate physical danger</li>
      </Ul>
      <P>Concerns may come from what a person directly says, or from concerning patterns in their messages (e.g., fear of going home, references to being hurt by someone).</P>

      <H2>5. What Staff Must Do</H2>
      <P>If a safeguarding concern arises during a conversation:</P>
      <Ul>
        <li><strong>Stay calm and supportive.</strong> Do not panic, express shock, or make the person feel judged.</li>
        <li><strong>Do not promise confidentiality.</strong> Never tell someone "this stays between us" — safeguarding concerns must be escalated.</li>
        <li><strong>Do not investigate or interrogate.</strong> Your role is to listen and escalate, not to determine what happened.</li>
        <li><strong>If there is immediate danger:</strong> advise the person to contact local emergency services immediately, and escalate internally right away.</li>
        <li><strong>Escalate every safeguarding concern</strong>, even if you are unsure whether it meets the threshold. It is always better to raise a concern than to stay silent.</li>
        <li><strong>Document what was said</strong>, as accurately and factually as possible, without adding your own interpretation, using the Platform's case notes/audit trail.</li>
      </Ul>

      <H2>6. Escalation Process</H2>
      <Ul>
        <li>HHF does not designate one permanent Safeguarding Lead. Instead, any senior admin available on HHF CareConnect at the time is responsible for receiving and acting on safeguarding escalations.</li>
        <li>All safeguarding concerns must be reported immediately to the senior admin currently available, via the Platform's internal escalation/flagging system, or by direct message/call if the matter is urgent.</li>
        <li>If no senior admin is immediately available and the situation is urgent, staff should advise the person to contact local emergency services directly, and continue attempting to reach any senior admin without delay.</li>
        <li>The senior admin who receives the escalation is responsible for deciding on next steps, which may include contacting relevant authorities, child protection services, or emergency services.</li>
      </Ul>

      <H2>7. Information Sharing</H2>
      <P>
        Normally, client information is kept private in line with our Privacy Policy. However, where a
        safeguarding concern involves risk of serious harm, HHF may share relevant information with
        relevant government child protection or welfare authorities, law enforcement (where there is
        risk to life or a crime has occurred), or emergency medical services (where there is immediate
        risk to health). Information will only be shared on a need-to-know basis, and staff should not
        share safeguarding information with anyone outside the proper escalation channel.
      </P>

      <H2>8. Support for Staff and Volunteers</H2>
      <P>
        Responding to disclosures of harm can be distressing. Staff and volunteers who handle a
        safeguarding concern are encouraged to speak with a senior admin for support afterward. No one
        should feel they must handle a serious disclosure alone.
      </P>

      <H2>9. Record-Keeping</H2>
      <P>
        All safeguarding concerns and the actions taken must be documented within HHF CareConnect's
        case/audit system. Records are kept securely and are only accessible to authorized staff, in
        line with our Privacy Policy.
      </P>

      <H2>10. Review</H2>
      <P>
        This policy will be reviewed periodically and updated as needed to reflect changes in law, best
        practice, or HHF's operations.
      </P>

      <H2>11. Contact</H2>
      <P>
        Safeguarding escalations: Any senior admin available on HHF CareConnect at the time<br />
        General contact: info@hhfoundation.com.ng<br />
        Phone: +234 703 312 3616
      </P>
    </LegalPage>
  )
}
