import { Router, Request, Response } from "express";
import { EducationAttestationService } from "../../services/attestation/education/EducationAttestationService.js";
import { getPassport } from "../../services/passportService.js";
import { requireSignedNonce } from "../../middleware/auth.js";
import { validateBody } from "../../utils/validate.js";
import { asAddress } from "../../utils/address.js";
import { DegreeBody, CourseBody, BootcampBody } from "../../openapi/schemas.js";
import { waitForIndexerReady } from "../../indexer/claimIndexer.js";

const router = Router();
const education = new EducationAttestationService();

router.post("/degree", requireSignedNonce, validateBody(DegreeBody), async (req: Request, res: Response) => {
  try {
    const { subject, institution, degree, fieldOfStudy, graduationYear } = req.body as {
      subject: string; institution: string; degree: string; fieldOfStudy: string; graduationYear: number;
    };
    const txHash = await education.issueDegree(asAddress(subject), institution, degree, fieldOfStudy, graduationYear);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "DEGREE_FAILED", message: (err as Error).message } });
  }
});

router.post("/course", requireSignedNonce, validateBody(CourseBody), async (req: Request, res: Response) => {
  try {
    const { subject, courseName, provider, score, certificateId } = req.body as {
      subject: string; courseName: string; provider: string; score: number; certificateId: string;
    };
    const txHash = await education.issueCourseCompletion(asAddress(subject), courseName, provider, score, certificateId);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "COURSE_FAILED", message: (err as Error).message } });
  }
});

router.post("/bootcamp", requireSignedNonce, validateBody(BootcampBody), async (req: Request, res: Response) => {
  try {
    const { subject, bootcamp, track, projectUri } = req.body as {
      subject: string; bootcamp: string; track: string; projectUri: string;
    };
    const txHash = await education.issueBootcamp(asAddress(subject), bootcamp, track, projectUri);
    res.json({ success: true, data: { txHash } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "BOOTCAMP_FAILED", message: (err as Error).message } });
  }
});

router.get("/:address", async (req: Request, res: Response) => {
  try {
    await waitForIndexerReady();
    const address = req.params.address as `0x${string}`;
    const passport = await getPassport(address);
    const svc = passport.services.education;
    res.json({
      success: true,
      data: { address, service: "education", verified: svc.verified, claimCount: svc.claimCount, claims: svc.claims },
    });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { code: "FETCH_ERROR", message: (err as Error).message } });
  }
});

export default router;
