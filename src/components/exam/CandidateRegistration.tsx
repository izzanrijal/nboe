import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface CandidateRegistrationProps {
  onComplete: (userId: string) => void;
}

const CandidateRegistration = ({ onComplete }: CandidateRegistrationProps) => {
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !dob || !email) {
      toast.error("All fields are required");
      return;
    }

    setLoading(true);
    try {
      // Deterministic password so returning candidates can sign in
      const password = `candidate_${email}_${dob}`;

      // Try sign up first
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      let userId: string | undefined;

      if (signUpError) {
        // If user exists, try sign in with same deterministic password
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          toast.error("Unable to authenticate. Please verify your details or contact the examiner.");
          setLoading(false);
          return;
        }
        userId = signInData.user?.id;
      } else {
        userId = signUpData.user?.id;
      }

      if (!userId) {
        toast.error("Authentication failed");
        setLoading(false);
        return;
      }

      // Update profile with DOB
      await supabase
        .from("profiles")
        .upsert({ id: userId, full_name: fullName, email, dob }, { onConflict: "id" });

      // Assign candidate role if not exists
      await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: "candidate" as const }, { onConflict: "user_id,role" });

      // Set session flag for one-time session
      sessionStorage.setItem("osce_session_active", "true");

      onComplete(userId);
    } catch (err) {
      toast.error("Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Candidate Registration</h1>
          <p className="text-muted-foreground text-sm">Enter your details to begin</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dr. John Smith"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input
              id="dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@hospital.com"
              required
            />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Registering..." : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CandidateRegistration;
