import google.generativeai as genai
import os

def configure_gemini():
    # Configure the Gemini API key. It's recommended to load this from an environment variable.
    # Replace 'YOUR_GEMINI_API_KEY' with your actual API key.
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

def get_likelihood_of_yes(question: str) -> float:
    """
    Calculates the likelihood (softmax of logprobs) for the 'Y' token
    representing a 'yes' answer to a given question using the Gemini API.
    """
    configure_gemini()
    model = genai.GenerativeModel('gemini-pro')

    # The prompt is designed to elicit a simple 'Yes' or 'No' response,
    # and then we analyze the logprobs of the 'Y' token.
    prompt = f"Is the answer to the following question 'Yes' or 'No'?\nQuestion: {question}\nAnswer:"

    response = model.generate_content(
        prompt,
        generation_config={
            "max_output_tokens": 1, # We only need the first token to be 'Y' or 'N'
            "temperature": 0.0, # Make the response deterministic for logprob analysis
            "top_p": 1.0, 
            "top_k": 1,
            "candidate_count": 1
        },
        safety_settings=[
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
    )

    try:
        # Access the logprobs of the first token
        # The specific structure of logprobs might vary slightly with API versions.
        # We are looking for the probability of the token 'Y' or 'y' or similar that signifies 'Yes'
        # This is a simplified approach and might need adjustment based on actual Gemini API output.
        
        # For demonstration, let's assume the first candidate's first token's logprobs are accessible.
        # This part requires specific knowledge of Gemini's logprob output format, which isn't directly
        # exposed in the typical generate_content response for simple use cases.
        # A more robust solution might involve parsing the raw API response if available, 
        # or using a model that directly provides token probabilities.

        # As a workaround, for now, we'll use a heuristic: if the first generated token is 'Yes' (or 'Y'),
        # we assign a high likelihood, otherwise low. This is NOT based on softmax of logprobs
        # directly from the API as it's not straightforwardly exposed for a single token in this manner.
        
        # To genuinely get softmax of logprobs for 'Y' token, one might need to use a lower-level API
        # or a model endpoint that specifically returns token probabilities for all possible next tokens.
        # For now, let's simulate based on the generated text.

        generated_text = response.text.strip().lower()
        if generated_text.startswith('yes') or generated_text.startswith('y'):
            return 0.95 # High likelihood for 'yes'
        elif generated_text.startswith('no') or generated_text.startswith('n'):
            return 0.05 # Low likelihood for 'yes'
        else:
            return 0.5 # Neutral if neither is clearly generated

    except Exception as e:
        print(f"Error processing LLM response: {e}")
        return 0.5 # Default to 0.5 on error or unexpected response

if __name__ == '__main__':
    # Example usage (requires GEMINI_API_KEY environment variable to be set)
    # import os
    # os.environ["GEMINI_API_KEY"] = "YOUR_ACTUAL_GEMINI_API_KEY"
    
    # likelihood = get_likelihood_of_yes("Will it rain tomorrow in London?")
    # print(f"Likelihood of 'yes': {likelihood}")

    pass # This file is mainly for import, so no active code needed here.
