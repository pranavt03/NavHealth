from anthropic import Anthropic
ANTHROPIC_API_KEY = "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"
anthropic = Anthropic(api_key=ANTHROPIC_API_KEY)

def summarize_file(file_path):
    try:
        with open(file_path, 'r') as file:
            text = file.read()
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found.")
        return
    response = toClaude(text)
    #print(response)
    with open('/Users/pranavtayi/Documents/testfilesummary.txt', 'w') as file:
        file.write(response)


# Define the toClaude function based on your given code
def toClaude(text):
    response = anthropic.messages.create(
        model="claude-3-5-sonnet-20240620",
        max_tokens=500,
        system="You are a medical coder with expertise in ICD-10-CM coding.",
        messages=[
            {"role": "user", "content": f"Do not provide any remarks or comments. Simply provide a key points summary of this text: {text}"}
        ]
    )
    #return response['content'][0]['text']
    return response.content[0].text


summarize_file('/Users/pranavtayi/Downloads/testfile.txt')
